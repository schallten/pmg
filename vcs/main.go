package main

import (
    "fmt"
    "vcs/checker"
    "vcs/auth"
    "vcs/commands"
    "os"
)

func main() {
    fmt.Println("PMG VCS ... booting up")

    configured := checker.CheckConfigured()

    if !configured {
        fmt.Println("PMG has not been initialized and won't track your files, please run the `init` command")
    } else {
        fmt.Println("PMG is configured and ready to track your files")
    }
    // take command like arguments and treat it as commands
    args := os.Args

    auth.AuthenticateUser()

    if (len(args) < 2){
        fmt.Println("No command provided. Type help to know all commands ")
        return
    }
    command := args[1]
    commands.ExecuteCommand(command)

}
