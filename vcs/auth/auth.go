package auth

import (
	"archive/zip"
	"bytes"
	"database/sql"
	"fmt"
	"io"
	"time"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"vcs/checker"
	vcsdb "vcs/database"
	"vcs/utils"

	_ "github.com/mattn/go-sqlite3"
)

const server_url = "https://pmg-backend-zojs.onrender.com/"

func AuthenticateUser() {
	configured := checker.CheckConfigured()
	if !configured {
		fmt.Println("PMG has not been initialized and won't track your files, please run the `init` command")
		return
	}
	fmt.Println("PMG is configured and ready to track your files")
	data, err := os.ReadFile(".pmg/configured.txt")
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
	db, err := vcsdb.InitDB()
	if err != nil {
		fmt.Println("error initializing database:", err)
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
	data, err := os.ReadFile(".pmg/configured.txt")
	if err != nil {
		fmt.Println("error reading configuration:", err)
		return
	}
	token := strings.TrimSpace(string(data))

	// Read project name
	// Read project name
	projectName, err := GetProjectName()
	if err != nil {
		fmt.Println("error reading project name:", err)
		return
	}
	// Check if repository config exists, if not prompt for username
	username, _, err := GetRepositoryConfig()
	if err != nil {
		// First time push - ask for username
		fmt.Print("Enter your username: ")
		username = utils.ReadInput()
		
		if username == "" {
			fmt.Println("Username is required")
			return
		}
		
		// Save for future use
		err = SaveRepositoryConfig(username, projectName)
		if err != nil {
			fmt.Println("Warning: Could not save repository config:", err)
		} else {
			fmt.Printf("Repository config saved: %s/%s\n", username, projectName)
		}
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
		
		// Re-hash the file to ensure we send the current hash of the content
		// This handles cases where the file changed between commit and push
		if hash != "DELETED" {
			currentHash, err := utils.HashFileContents(path)
			if err == nil {
				hash = currentHash
			}
		}
		
		writer.WriteField("hash", hash)
		writer.WriteField("last_updated", fmt.Sprintf("%d", lastUpdated))
		writer.WriteField("commit_message", commitMessage)
		writer.WriteField("author", author)

		// Add file content
		if hash != "DELETED" {
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
			fmt.Printf("Request failed: %v\n", err)
			failCount++
			continue
		}

		if resp.StatusCode != http.StatusOK {
			bodyBytes, _ := io.ReadAll(resp.Body)
			fmt.Printf("Server error %s: %s\n", resp.Status, string(bodyBytes))
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

func Pull() {
	if err := os.MkdirAll(".pmg", 0755); err != nil {
		fmt.Println("error creating .pmg directory:", err)
		return
	}

	username, projectName, err := GetRepositoryConfig()
	
	if err != nil {
		// Config doesn't exist, ask user
		fmt.Println("Please enter username and project name of the repository")
		fmt.Print("Username: ")
		username = utils.ReadInput()
		fmt.Print("Project Name: ")
		projectName = utils.ReadInput()
		
		if username == "" || projectName == "" {
			fmt.Println("username and project name is needed")
			return
		}
		
		// Save for future use
		SaveRepositoryConfig(username, projectName)
	} else {
		fmt.Printf("Using repository: %s/%s\n", username, projectName)
	}

	data, err := os.ReadFile(".pmg/configured.txt")
	var token string
	if err != nil {
		if os.IsNotExist(err) {
			fmt.Println("API key not found. Please enter your API key from the PMG website:")
			token = utils.ReadInput()
			if token == "" {
				fmt.Println("API key is required to pull from the server")
				return
			}
			err = os.WriteFile(".pmg/configured.txt", []byte(token), 0644)
			if err != nil {
				fmt.Println("error saving API key:", err)
				return
			}
		} else {
			fmt.Println("error reading configuration:", err)
			return
		}
	} else {
		token = strings.TrimSpace(string(data))
	}

	// Also ensure author is set
	if _, err := os.Stat(".pmg/author.txt"); os.IsNotExist(err) {
		fmt.Println("Please enter your username for commits:")
		author := utils.ReadInput()
		if author != "" {
			os.WriteFile(".pmg/author.txt", []byte(author), 0644)
		}
	}

	// Initialize database if it doesn't exist
	vdb, err := vcsdb.InitDB()
	if err != nil {
		fmt.Println("Warning: Could not initialize local database:", err)
	} else {
		vdb.Close()
	}

	url := fmt.Sprintf("%sapi/pull/%s/%s", server_url, username, projectName)
	req, err := http.NewRequest("POST", url, nil)
	if err != nil {
		fmt.Println("error creating request:", err)
		return
	}
	req.Header.Set("Authorization", "Bearer "+token)

	fmt.Printf("pulling %s/%s from the server ...\n", username, projectName)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		fmt.Println("error sending request:", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		fmt.Printf("Server error %s: %s\n", resp.Status, string(bodyBytes))
		return
	}

	tempDir := ".pmg/temp_full"
	os.RemoveAll(tempDir) // clean up old remains
	err = os.MkdirAll(tempDir, os.ModePerm)
	if err != nil {
		fmt.Println("error creating temp directory:", err)
		return
	}

	// saving zip file
	zipPath := filepath.Join(tempDir, projectName+".zip")
	zipFile, err := os.Create(zipPath)
	if err != nil {
		fmt.Println("error creating zip file:", err)
		return
	}
	_, err = io.Copy(zipFile, resp.Body)
	if err != nil {
		fmt.Println("error saving zip file:", err)
		zipFile.Close()
		return
	}

	// ext4catcing the zip
	fmt.Println("extracting files...")
	err = extractZip(zipPath, ".")
	if err != nil {
		fmt.Println("error extracting zip file:", err)
		zipFile.Close()
		return
	}

	os.RemoveAll(tempDir)
	fmt.Println("Pull completed successfully.")
}

func Fetch(){
	username,projectName,err := GetRepositoryConfig()

	if err!=nil{
		fmt.Println("please enter username and project name of the repository")
		fmt.Println("username : ")
		username = utils.ReadInput()
		fmt.Println("project name : ")
		projectName = utils.ReadInput()
		if username=="" || projectName==""{
			fmt.Println("username and project name is needed")
			return
		}
		SaveRepositoryConfig(username,projectName)
	} else {
		fmt.Printf("using repository : %s/%s\n",username,projectName)
	}

	// since fetch doesnt need auth we continue 
	url := fmt.Sprintf("%sapi/fetch/%s/%s",server_url,username,projectName)
	req,err := http.NewRequest("GET",url,nil)
	if err!=nil{
		fmt.Println("error creating request:",err)
		return
	}

	fmt.Printf("fetching %s/%s from the server ...\n",username,projectName)

	resp,err := http.DefaultClient.Do(req)
	if err!=nil{
		fmt.Println("error sending request:",err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		fmt.Printf("Server error %s: %s\n", resp.Status, string(bodyBytes))
		return
	}

	bodyBytes,err := io.ReadAll(resp.Body)
	if err!=nil{
		fmt.Println("error reading response body:",err)
		return
	}

	responseStr := string(bodyBytes)

	serverCommitID := extractJSONValue(responseStr,"latest_commit_id")
	serverTimestamp := extractJSONValue(responseStr,"timestamp")

	if serverCommitID=="" || serverTimestamp==""{
		fmt.Println("error: invalid response from server")
		return
	}

	// try multiple layouts for parsing server timestamp
	var serverTime time.Time
	layouts := []string{time.RFC3339, "2006-01-02T15:04:05.999999", "2006-01-02T15:04:05"}
	
	for _, layout := range layouts {
		serverTime, err = time.Parse(layout, serverTimestamp)
		if err == nil {
			break
		}
	}

	if err != nil {
		fmt.Println("error parsing server timestamp:", err)
		return
	}
	serverUnixTime := serverTime.Unix()

	// now we have serverCommitID and serverUnixTime
	fmt.Printf("Latest commit on server: %s at %d\n",serverCommitID,serverUnixTime)

	// get local latest commit
	db, err := vcsdb.InitDB()
	if err != nil {
		fmt.Println("error initializing database:", err)
		return
	}
	defer db.Close()

	var localCommitID string
	var localTimestamp int64
	serverUnix := serverTime.Unix()

	err = db.QueryRow(
		`SELECT commit_id, last_updated
		FROM files
		ORDER BY last_updated DESC
		LIMIT 1`).Scan(&localCommitID,&localTimestamp)

	if err == sql.ErrNoRows {
		fmt.Println("\nno local commits found, but server has commits")
		fmt.Println("would you like to pull? (y/n) :")
		answer := utils.ReadInput()

		if strings.ToLower(answer) == "y" {
			Pull()
		} else {
			fmt.Println("fetch aborted.")
		}
		return
	}
	
	if err!=nil{
		fmt.Println("error querying local commits:",err)
		return
	}

	fmt.Printf("\nLocal: %s (timestamp : %d)\n",localCommitID,localTimestamp)
	fmt.Printf("Server: %s (timestamp: %d)\n", serverCommitID, serverUnix)
	
		if localTimestamp > serverUnix {
		// Local is ahead
		fmt.Println("\n✓ Your local repository is ahead of the server")
		fmt.Print("Would you like to push your changes? (y/n): ")
		answer := utils.ReadInput()
		
		if strings.ToLower(answer) == "y" || strings.ToLower(answer) == "yes" {
			PushCommit("")
		}
	} else if localTimestamp < serverUnix {
		// Server is ahead
		fmt.Println("\n✓ Server has newer commits")
		fmt.Print("Would you like to pull? (y/n): ")
		answer := utils.ReadInput()
		
		if strings.ToLower(answer) == "y" || strings.ToLower(answer) == "yes" {
			Pull()
		}
	} else {
		// Same
		fmt.Println("\n✓ Your local repository is up to date with the server")
	}
}

func extractJSONValue(jsonStr, key string) string {
	// Find the key
	keyStr := fmt.Sprintf("\"%s\":", key)
	startIdx := strings.Index(jsonStr, keyStr)
	if startIdx == -1 {
		return ""
	}
	
	// Move past the key
	startIdx += len(keyStr)
	
	// Find the opening quote
	quoteIdx := strings.Index(jsonStr[startIdx:], "\"")
	if quoteIdx == -1 {
		return ""
	}
	startIdx += quoteIdx + 1
	
	// Find the closing quote
	endIdx := strings.Index(jsonStr[startIdx:], "\"")
	if endIdx == -1 {
		return ""
	}
	
	return jsonStr[startIdx : startIdx+endIdx]
}

func extractZip(zipPath, destDir string) error {
	archive, err := zip.OpenReader(zipPath)
	if err != nil {
		return err
	}
	defer archive.Close()

	for _, file := range archive.File {
		filePath := filepath.Join(destDir, file.Name)

		if file.FileInfo().IsDir() {
			os.MkdirAll(filePath, os.ModePerm)
			continue
		}

		if err := os.MkdirAll(filepath.Dir(filePath), os.ModePerm); err != nil {
			return err
		}

		dstFile, err := os.Create(filePath)
		if err != nil {
			return err
		}

		srcFile, err := file.Open()
		if err != nil {
			dstFile.Close()
			return err
		}

		_, err = io.Copy(dstFile, srcFile)
		dstFile.Close()
		srcFile.Close()
		if err != nil {
			return err
		}
	}
	return nil
}

// Save repository info to config file
// GetProjectName returns the project name either from a small project file or by using the current directory name.
func GetProjectName() (string, error) {
	// First try to read a dedicated project name file
	if data, err := os.ReadFile(".pmg/project_name.txt"); err == nil {
		name := strings.TrimSpace(string(data))
		if name != "" {
			return name, nil
		}
	}

	// Fallback to the current working directory name
	wd, err := os.Getwd()
	if err != nil {
		return "", fmt.Errorf("could not determine project name: %w", err)
	}
	return filepath.Base(wd), nil
}

// Save repository info to config file
func SaveRepositoryConfig(username, projectName string) error {
	configPath := ".pmg/repository.txt"
	content := fmt.Sprintf("%s/%s", username, projectName)
	return os.WriteFile(configPath, []byte(content), 0644)
}
// Get repository info from config file
func GetRepositoryConfig() (username, projectName string, err error) {
	configPath := ".pmg/repository.txt"
	data, err := os.ReadFile(configPath)
	if err != nil {
		return "", "", err
	}
	
	parts := strings.Split(strings.TrimSpace(string(data)), "/")
	if len(parts) != 2 {
		return "", "", fmt.Errorf("invalid repository config format")
	}
	
	return parts[0], parts[1], nil
}