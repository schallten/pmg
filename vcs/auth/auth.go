package auth

import (
	"bytes"
	"database/sql"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"vcs/checker"
	"vcs/commands"

	_ "github.com/mattn/go-sqlite3"
)

const server_url = "http://localhost:3000/"

func AuthenticateUser() {
	configured := checker.CheckConfigured()
	if !configured {
		fmt.Println("PMG has not been initialized and won't track your files, please run the `init` command")
		return
	}
	fmt.Println("PMG is configured and ready to track your files")
	data, err := os.ReadFile("./vcs/configured.txt")
	if err != nil {
		fmt.Println("error reading configuration:", err)
		return
	}
	token := string(data)
	client := &http.Client{}
	req, err := http.NewRequest("GET", server_url+"api/authenticate", nil)
	if err != nil {
		fmt.Println("error creating request:", err)
		return
	}
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := client.Do(req)
	if err != nil {
		fmt.Println("error sending request:", err)
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusOK {
		fmt.Println("User authenticated successfully")
	} else {
		fmt.Println("Authentication failed with status:", resp.Status)
	}
}

func PushCommit(commitID string) {
	fmt.Println("Pushing commit", commitID, "to server...")
	db, err := sql.Open("sqlite3", "./vcs/vcs.db")
	if err != nil {
		fmt.Println("error opening database:", err)
		return
	}
	defer db.Close()

	// Resolve commit ID if not provided
	if commitID == "" {
		err := db.QueryRow(`
            SELECT commit_id
            FROM files
            WHERE is_synced = 0
            ORDER BY last_updated DESC
            LIMIT 1
        `).Scan(&commitID)
		if err == sql.ErrNoRows {
			fmt.Println("No unsynced commits found")
			return
		}
		if err != nil {
			fmt.Println("error finding unsynced commit:", err)
			return
		}
		fmt.Println("No commit ID provided, using latest unsynced:", commitID)
	}

	query := `
        SELECT path, hash, last_updated, commit_message, author, commit_id
        FROM files
        WHERE commit_id = ? AND is_synced = 0
    `
	rows, err := db.Query(query, commitID)
	if err != nil {
		fmt.Println("error querying files:", err)
		return
	}
	defer rows.Close()

	// Read API token
	data, err := os.ReadFile("./vcs/configured.txt")
	if err != nil {
		fmt.Println("error reading configuration:", err)
		return
	}
	token := strings.TrimSpace(string(data))

	// Read project name
	projectName, err := commands.GetProjectName()
	if err != nil {
		fmt.Println("error reading project name:", err)
		return
	}

	// Push each file individually
	successCount := 0
	failCount := 0
	totalFiles := 0

	for rows.Next() {
		var path, hash, commitMessage, author, commitIDFromDB string
		var lastUpdated int

		err := rows.Scan(&path, &hash, &lastUpdated, &commitMessage, &author, &commitIDFromDB)
		if err != nil {
			fmt.Println("error scanning row:", err)
			return
		}

		totalFiles++
		fmt.Printf("Uploading file %d: %s\n", totalFiles, path)

		// Create multipart form
		body := &bytes.Buffer{}
		writer := multipart.NewWriter(body)

		// Add metadata fields
		writer.WriteField("commit_id", commitIDFromDB)
		writer.WriteField("project_name", projectName)
		writer.WriteField("path", path)
		writer.WriteField("hash", hash)
		writer.WriteField("last_updated", fmt.Sprintf("%d", lastUpdated))
		writer.WriteField("commit_message", commitMessage)
		writer.WriteField("author", author)

		// Add file content
		file, err := os.Open(path)
		if err != nil {
			fmt.Printf("  ✗ Failed to open file: %v\n", err)
			failCount++
			writer.Close()
			continue
		}

		part, err := writer.CreateFormFile("file", filepath.Base(path))
		if err != nil {
			fmt.Printf("  ✗ Failed to create form: %v\n", err)
			file.Close()
			failCount++
			writer.Close()
			continue
		}

		_, err = io.Copy(part, file)
		file.Close()
		if err != nil {
			fmt.Printf("  ✗ Failed to copy file: %v\n", err)
			failCount++
			writer.Close()
			continue
		}

		writer.Close()

		// Create request
		req, err := http.NewRequest("POST", server_url+"api/push/file", body)
		if err != nil {
			fmt.Printf("  ✗ Failed to create request: %v\n", err)
			failCount++
			continue
		}

		req.Header.Set("Authorization", "Bearer "+token)
		req.Header.Set("Content-Type", writer.FormDataContentType())

		// Send request
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			fmt.Printf("  ✗ Request failed: %v\n", err)
			failCount++
			continue
		}

		if resp.StatusCode != http.StatusOK {
			bodyBytes, _ := io.ReadAll(resp.Body)
			fmt.Printf("  ✗ Server error %s: %s\n", resp.Status, string(bodyBytes))
			resp.Body.Close()
			failCount++
			continue
		}

		resp.Body.Close()
		fmt.Printf("  ✓ Success\n")
		successCount++
	}

	fmt.Printf("\nPush summary: %d succeeded, %d failed out of %d\n", successCount, failCount, totalFiles)

	// Mark as synced only if all files were pushed successfully
	if failCount == 0 && totalFiles > 0 {
		_, err = db.Exec(`UPDATE files SET is_synced = 1 WHERE commit_id = ?`, commitID)
		if err != nil {
			fmt.Println("error updating sync status:", err)
			return
		}
		fmt.Println("Commit marked as synced")
	} else if failCount > 0 {
		fmt.Println("Some files failed to push. Commit not marked as synced.")
		fmt.Println("Run 'push' again to retry failed files.")
	}
}