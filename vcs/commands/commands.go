package commands

import (
	"crypto/sha256"
	// "database/sql"
	"encoding/hex"
	// "fmt"
	"io"
	"os"
	// "time"

	_ "github.com/mattn/go-sqlite3"
)

func hashFileContents(path string)(string, error){
	f,err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()

	hasher := sha256.New()
	if _,err := io.Copy(hasher,f); err != nil {
		return "", err
	}
	return hex.EncodeToString(hasher.Sum(nil)), nil
}

func ExecuteCommand(command string){
	switch command {
	case "init":
		// do nothiong for now
		return
	}
}

