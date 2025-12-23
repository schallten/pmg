package commands

import (
	"bufio"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"vcs/auth"
	vcsdb "vcs/database"
	"vcs/utils"

	"github.com/google/uuid"
	_ "github.com/mattn/go-sqlite3"
)

const maxFileSize = 5 * 1024 * 1024 // 5 MB



// GetProjectName reads the project name from the configuration file
func GetProjectName() (string, error) {
	data, err := os.ReadFile(".pmg/project_name.txt")
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
	case "push":
		auth.PushCommit("")
	case "pull":
		auth.Pull()
	case "fetch":
		auth.Fetch()
	case "help":
		ExecuteHelp()
	default:
		fmt.Println("invalid command. Type 'help' to see available commands.")
	}
}

func ExecuteHelp() {
	fmt.Println("\nPMG VCS - Poor Man's Git (Educational Experiment)")
	fmt.Println("=================================================")
	fmt.Println("\nUsage: vcs <command> [arguments]")
	fmt.Println("\nAvailable Commands:")
	
	fmt.Println("\n  init")
	fmt.Println("    Initialize a new repository in the current directory.")
	fmt.Println("    Prompts for username and API key.")
	fmt.Println("    Note: The project name on the server is derived from the folder name.")
	
	fmt.Println("\n  add")
	fmt.Println("    Stage changes for the next commit.")
	fmt.Println("    Detects new, modified, and deleted files.")
	fmt.Println("    Uses 'ignore.txt' to skip files/directories.")
	
	fmt.Println("\n  commit")
	fmt.Println("    Record staged changes to the local history.")
	fmt.Println("    Requires a commit message (max 50 characters).")
	fmt.Println("    Note: You must 'push' before making a new commit.")
	
	fmt.Println("\n  push")
	fmt.Println("    Upload the latest local commit to the PMG server.")
	
	fmt.Println("\n  pull")
	fmt.Println("    Download and reconcile the latest version from the server.")
	fmt.Println("    Can be used to clone a project into an empty directory.")
	
	fmt.Println("\n  fetch")
	fmt.Println("    Check server state and compare with local repository.")
	fmt.Println("    Reports if you are ahead, behind, or up-to-date.")
	
	fmt.Println("\n  help")
	fmt.Println("    Show this detailed help message.")
	
	fmt.Println("\nConfiguration:")
	fmt.Println("  - .pmg/           Internal VCS state directory")
	fmt.Println("  - ignore.txt      List of files/folders to ignore (one per line)")
	fmt.Println("\nFor more information, visit the PMG website documentation.")
	fmt.Println("=================================================\n")
}

/* COMMANDS */
func ExecuteInit() {
	fmt.Println("initializing PMG VCS...")
	// create folder and files for initial configuration
	err := os.MkdirAll(".pmg", os.ModePerm)
	if err != nil {
		fmt.Println("error creating vcs directory:", err)
		return
	}

	_, _ = vcsdb.InitDB()

	fmt.Println("Enter username as used on website :")
	author := utils.ReadInput()
	// save name in file 
	authorFile, err := os.Create(".pmg/author.txt")
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
	file, err := os.Create(".pmg/configured.txt")
	if err != nil {
		fmt.Println("error creating configuration file:", err)
		return
	}
	defer file.Close()

	fmt.Println("Please enter api key from PMG website")
	apiKey := utils.ReadInput()
	// save to file
	_, err = file.WriteString(apiKey)
	if err != nil {
		fmt.Println("error writing to configuration file:", err)
		return
	}

	fmt.Println("Please enter project name. This name will be visible on the website")
	projectName := utils.ReadInput()
	// save to file
	projectFile, err := os.Create(".pmg/project_name.txt")
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
	var ignorePatterns []string

	if err == nil {
		defer ignoreFile.Close()
		scanner := bufio.NewScanner(ignoreFile)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line != "" && !strings.HasPrefix(line, "#") {
				// Normalize path separators to / for consistency
				line = filepath.ToSlash(line)
				line = strings.TrimSuffix(line, "/")
				ignorePatterns = append(ignorePatterns, line)
			}
		}
	}

	isIgnored := func(path string) bool {
		// Always ignore .pmg directory
		if strings.HasPrefix(path, ".pmg") || strings.Contains(path, "/.pmg") {
			return true
		}

		normalizedPath := filepath.ToSlash(path)
		parts := strings.Split(normalizedPath, "/")

		for _, pattern := range ignorePatterns {
			// Exact match
			if normalizedPath == pattern {
				return true
			}
			// Directory match (pattern is a prefix of the path)
			if strings.HasPrefix(normalizedPath, pattern+"/") {
				return true
			}
			// Component match (e.g., "node_modules" should match "src/node_modules/...")
			for _, part := range parts {
				if part == pattern {
					return true
				}
			}
		}
		return false
	}

	// Initialize database to check for existing files
	db, dbErr := vcsdb.InitDB()
	if dbErr != nil {
		fmt.Println("error initializing database:", dbErr)
		return
	}
	defer db.Close()

	// ensure vcs directory exists for staged file
	if err := os.MkdirAll(".pmg", os.ModePerm); err != nil {
		fmt.Println("error creating vcs directory:", err)
		return
	}

	stagedFile, sfErr := os.OpenFile(".pmg/staged_files.txt", os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
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

		if isIgnored(path) {
			// fmt.Println("ignoring file:", path)
			return nil
		}

		if info.Size() > maxFileSize {
			fmt.Println("skipping file (too large):", path)
			return nil
		}

		hash, hashErr := utils.HashFileContents(path)
		if hashErr != nil {
			fmt.Println("error hashing file:", hashErr)
			return nil
		}

		// Check if file has changed
		var lastHash string
		err := db.QueryRow("SELECT hash FROM files WHERE path = ? ORDER BY id DESC LIMIT 1", path).Scan(&lastHash)
		if err != nil && err != sql.ErrNoRows {
			fmt.Println("error querying database:", err)
			return nil
		}

		if err == nil && lastHash == hash {
			// File hasn't changed, skip it
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

	// Check for deleted files
	rows, err := db.Query("SELECT DISTINCT path FROM files")
	if err != nil {
		fmt.Println("error querying database for deleted files:", err)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var path string
		if err := rows.Scan(&path); err != nil {
			continue
		}

		// Check if file is ignored
		if isIgnored(path) {
			continue
		}

		// Check if file exists
		if _, err := os.Stat(path); os.IsNotExist(err) {
			// File is missing, check if it was already marked as deleted
			var lastHash string
			err := db.QueryRow("SELECT hash FROM files WHERE path = ? ORDER BY id DESC LIMIT 1", path).Scan(&lastHash)
			if err == nil && lastHash == "DELETED" {
				continue // Already deleted
			}

			fmt.Printf("deleted file: %s\n", path)
			_, writeErr := stagedFile.WriteString("DELETED " + path + "\n")
			if writeErr != nil {
				fmt.Println("error writing to staged_files.txt file:", writeErr)
			}
		}
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
	db, dbErr := vcsdb.InitDB()
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
	stagedFile, err := os.Open(".pmg/staged_files.txt")
	if err != nil {
		fmt.Println("error opening staged_files.txt file:", err)
		return
	}
	defer stagedFile.Close()

	fmt.Println("please enter commit message (max 50 characters):")

	commitMsg := utils.ReadInput()

	if len(commitMsg) > 50 {
		fmt.Println("commit message exceeds 50 characters")
		return
	}

	// Generate a single UUID for this commit
	commitID := uuid.New().String()
	fmt.Println("Commit ID:", commitID)

	// get author name from file
	author,err := os.ReadFile(".pmg/author.txt")


	scanner := bufio.NewScanner(stagedFile)
	fileCount := 0
	for scanner.Scan() {
		line := scanner.Text()
		var path, hash string
		var hashErr error

		if strings.HasPrefix(line, "DELETED ") {
			path = strings.TrimPrefix(line, "DELETED ")
			hash = "DELETED"
		} else {
			path = line
			hash, hashErr = utils.HashFileContents(path)
			if hashErr != nil {
				fmt.Println("error hashing file:", path, hashErr)
				continue
			}
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
	os.Truncate(".pmg/staged_files.txt", 0)
	
	fmt.Printf("Commit successful! %d file(s) committed with ID: %s\n", fileCount, commitID)
	fmt.Println("Run 'push' command to push to server")
}