package commands

import (
	"bufio"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
	_ "github.com/mattn/go-sqlite3"
)

const maxFileSize = 5 * 1024 * 1024 // 5 MB

func initDB() (*sql.DB, error) {
	db, err := sql.Open("sqlite3", "./vcs/vcs.db")
	if err != nil {
		return nil, err
	}

	_, err = db.Exec(`
	CREATE TABLE IF NOT EXISTS files (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		path TEXT NOT NULL,
		hash TEXT NOT NULL,
		last_updated INTEGER NOT NULL,
		commit_message TEXT NOT NULL,
		author TEXT NOT NULL,
		commit_id TEXT NOT NULL,
		is_synced INTEGER DEFAULT 0
	)
	`)
	if err != nil {
		db.Close()
		return nil, err
	}

	fmt.Println("Database initialized")
	return db, nil
}

func hashFileContents(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()

	hasher := sha256.New()
	if _, err := io.Copy(hasher, f); err != nil {
		return "", err
	}
	return hex.EncodeToString(hasher.Sum(nil)), nil
}

// GetProjectName reads the project name from the configuration file
func GetProjectName() (string, error) {
	data, err := os.ReadFile("./vcs/project_name.txt")
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(data)), nil
}

func ExecuteCommand(command string) {
	switch command {
	case "init":
		ExecuteInit()
	case "add":
		ExecuteAdd()
	case "commit":
		ExecuteCommit()
	default:
		fmt.Println("invalid command")
	}
}

/* COMMANDS */
func ExecuteInit() {
	fmt.Println("initializing PMG VCS...")
	initDB()
	// create folder and files for initial configuration
	err := os.MkdirAll("./vcs", os.ModePerm)
	if err != nil {
		fmt.Println("error creating vcs directory:", err)
		return
	}

	fmt.Println("Enter username as used on website :")
	var author string
	fmt.Scanln(&author)
	// save name in file 
	authorFile, err := os.Create("./vcs/author.txt")
	if err != nil {
		fmt.Println("error creating author file:", err)
		return
	}
	defer authorFile.Close()

	_, err = authorFile.WriteString(author)
	if err != nil {
		fmt.Println("error writing to author file:", err)
		return
	}

	// create configured.txt file to indicate initialization
	file, err := os.Create("./vcs/configured.txt")
	if err != nil {
		fmt.Println("error creating configuration file:", err)
		return
	}
	defer file.Close()

	fmt.Println("Please enter api key from PMG website")
	var apiKey string
	fmt.Scanln(&apiKey)
	// save to file
	_, err = file.WriteString(apiKey)
	if err != nil {
		fmt.Println("error writing to configuration file:", err)
		return
	}

	fmt.Println("Please enter project name. This name will be visible on the website")
	var projectName string
	fmt.Scanln(&projectName)
	// save to file
	projectFile, err := os.Create("./vcs/project_name.txt")
	if err != nil {
		fmt.Println("error creating project name file:", err)
		return
	}
	defer projectFile.Close()

	_, err = projectFile.WriteString(projectName)
	if err != nil {
		fmt.Println("error writing to project name file:", err)
		return
	}

	fmt.Println(" ========================================= ")

	fmt.Println("PMG VCS initialized successfully \n Run `help` command to know about all commands \n Files to be ignored should be saved in a file named ignore.txt , one file per line with appropriate paths")

	fmt.Println(" ========================================= ")
}

func ExecuteAdd() {
	fmt.Println("adding files to PMG VCS...")

	ignoreFile, err := os.Open("ignore.txt")

	if err != nil {
		fmt.Println("error opening ignore.txt file:", err)
		return
	}

	defer ignoreFile.Close()

	ignoreMap := make(map[string]bool)

	scanner := bufio.NewScanner(ignoreFile)
	for scanner.Scan() {
		ignoreMap[scanner.Text()] = true
	}

	if err := scanner.Err(); err != nil {
		fmt.Println("error reading ignore file:", err)
	}

	// ensure vcs directory exists for staged file
	if err := os.MkdirAll("./vcs", os.ModePerm); err != nil {
		fmt.Println("error creating vcs directory:", err)
		return
	}

	stagedFile, sfErr := os.OpenFile("./vcs/staged_files.txt", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if sfErr != nil {
		fmt.Println("error opening staged_files.txt file:", sfErr)
		return
	}
	defer stagedFile.Close()

	err = filepath.Walk(".", func(path string, info os.FileInfo, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}

		if info.IsDir() {
			return nil
		}

		if ignoreMap[path] {
			fmt.Println("ignoring file:", path)
			return nil
		}

		if info.Size() > maxFileSize {
			fmt.Println("skipping file (too large):", path)
			return nil
		}

		hash, hashErr := hashFileContents(path)
		if hashErr != nil {
			fmt.Println("error hashing file:", hashErr)
			return nil
		}

		fmt.Printf("file: %s , hash: %s\n", path, hash)

		_, writeErr := stagedFile.WriteString(path + "\n")
		if writeErr != nil {
			fmt.Println("error writing to staged_files.txt file:", writeErr)
		}

		return nil
	})

	if err != nil {
		fmt.Println("error walking directory:", err)
	}
}

func checkPreviousCommitSynced(db *sql.DB) (bool, error) {
	var unsyncedCount int
	err := db.QueryRow(`SELECT COUNT(*) FROM files WHERE is_synced = 0`).Scan(&unsyncedCount)
	if err != nil {
		return false, err
	}
	
	if unsyncedCount > 0 {
		return false, nil
	}
	
	return true, nil
}

func ExecuteCommit() {
	fmt.Println("committing files to PMG VCS...")
	
	// Initialize database
	db, dbErr := initDB()
	if dbErr != nil {
		fmt.Println("error initializing database:", dbErr)
		return
	}
	defer db.Close()
	
	// Check if previous commit was synced
	isSynced, err := checkPreviousCommitSynced(db)
	if err != nil {
		fmt.Println("error checking previous commit sync status:", err)
		return
	}
	
	if !isSynced {
		fmt.Println("ERROR: Previous commit has not been synced. Please run 'push' command before making a new commit.")
		return
	}
	
	// Read staged changes file
	stagedFile, err := os.Open("./vcs/staged_files.txt")
	if err != nil {
		fmt.Println("error opening staged_files.txt file:", err)
		return
	}
	defer stagedFile.Close()

	fmt.Println("please enter commit message (max 50 characters):")

	reader := bufio.NewReader(os.Stdin)
	commitMsg, err := reader.ReadString('\n')
	if err != nil {
		fmt.Println("error reading input:", err)
		return
	}

	commitMsg = strings.TrimSpace(commitMsg)

	if len(commitMsg) > 50 {
		fmt.Println("commit message exceeds 50 characters")
		return
	}

	// Generate a single UUID for this commit
	commitID := uuid.New().String()
	fmt.Println("Commit ID:", commitID)

	// get author name from file
	author,err := os.ReadFile("./vcs/author.txt")


	scanner := bufio.NewScanner(stagedFile)
	fileCount := 0
	for scanner.Scan() {
		path := scanner.Text()
		hash, hashErr := hashFileContents(path)
		if hashErr != nil {
			fmt.Println("error hashing file:", path, hashErr)
			continue
		}

		_, err := db.Exec(`INSERT INTO files (path, hash, last_updated, commit_message, author, commit_id) VALUES (?, ?, ?, ?, ?, ?)`,
			path,
			hash,
			os.Geteuid(),
			commitMsg,
			author,
			commitID,
		)

		if err != nil {
			fmt.Println("error inserting into database:", err)
		} else {
			fileCount++
		}
	}

	if err := scanner.Err(); err != nil {
		fmt.Println("error reading staged files:", err)
	}

	// Clear staged files
	os.Truncate("./vcs/staged_files.txt", 0)
	
	fmt.Printf("Commit successful! %d file(s) committed with ID: %s\n", fileCount, commitID)
	fmt.Println("Run 'push' command to push to server")
}