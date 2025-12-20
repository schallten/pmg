package checker

import (
    "fmt"
    "os"
)

var ConfigFile = "./vcs/configured.txt"

func CheckConfigured() bool {
    _, err := os.Stat(ConfigFile)
    if err != nil {
        if os.IsNotExist(err) {
            return false
        }
        fmt.Println("error checking configuration:", err)
        return false
    }
    return true
}
