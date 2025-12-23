package database

import (
	"database/sql"
	_ "github.com/mattn/go-sqlite3"
)

func InitDB() (*sql.DB, error) {
	db, err := sql.Open("sqlite3", ".pmg/vcs.db")
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

	return db, nil
}
