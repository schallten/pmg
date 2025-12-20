package auth

import (
	"fmt"
	"net/http"
	"os"
	"vcs/checker"
)

const server_url = "http://localhost:3000/"

func AuthenticateUser() {
	configured := checker.CheckConfigured()

	if !configured {
		fmt.Println("PMG has not been initialized and won't track your files, please run the `init` command")
		return
	}

	fmt.Println("PMG is configured and ready to track your files")

	// Read token
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

	// Send request
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
