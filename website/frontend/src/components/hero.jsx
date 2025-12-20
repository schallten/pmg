import React from "react";

export default function Hero() {
    return (
        <div className="hero">
            <img src="https://i.pinimg.com/1200x/0b/aa/d9/0baad964298800a50223056d0eeddf4b.jpg" className="hero_left_image"/>
            <div className="hero_right_text">
                <h3>Welcome to PMG </h3>
                <p>this is a project made to imitate git hosting websites by engineering its own VCS ( version control system ) and its own code editor amongst many planned things.Hope you enjoy it. You can signup and download the vcs client to start working with the website.Or utilize the search feature to search for existing repositories and get the one you wanted.</p>
            </div>
        </div>
    )
}