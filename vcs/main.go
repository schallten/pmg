package main

import (
    "fmt"
    "vcs/commands"
    "os"
)

func main() {
    fmt.Println("PMG VCS ... booting up")

    // take command like arguments and treat it as commands
    args := os.Args

    if (len(args) < 2){
        fmt.Println("No command provided. Type 'help' to see all available commands.")
        return
    }
    command := args[1]
    commands.ExecuteCommand(command)

}
