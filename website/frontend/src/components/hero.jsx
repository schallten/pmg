import React from "react";

export default function Hero() {
    return (
        <>
            <div className="hero">
                <img src="https://plus.unsplash.com/premium_photo-1665329006421-4e945f91885f?q=80&w=687&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" className="hero_left_image" />
                <div className="hero_right_text">
                    <h3>Welcome to PMG - A Learning Project</h3>
                    <p>This is an educational project built to understand how git hosting platforms work by creating a custom version control system (VCS) from scratch. It includes a custom code editor, deployment features, and more. This is a learning exercise to explore the internals of version control and web development.</p>
                </div>
            </div>

            {/* Features Section */}
            <div className="features_section">
                <h2 className="section_heading">What's Inside This Project?</h2>
                <div className="features_grid">
                    <div className="feature_card">
                        <h3>Custom VCS</h3>
                        <p>A version control system built from scratch to understand how Git works under the hood.</p>
                    </div>
                    <div className="feature_card">
                        <h3>Web-Based Editor</h3>
                        <p>Experiment with code editing directly in the browser.</p>
                    </div>
                    <div className="feature_card">
                        <h3>Static Hosting</h3>
                        <p>Deploy static sites from repositories, similar to GitHub Pages.</p>
                    </div>
                    <div className="feature_card">
                        <h3>Repository Search</h3>
                        <p>Search and browse public repositories on the platform.</p>
                    </div>
                    <div className="feature_card">
                        <h3>Social Features</h3>
                        <p>Star and fork repositories to learn about social coding features.</p>
                    </div>
                    <div className="feature_card">
                        <h3>Code Analytics</h3>
                        <p>Visualize project composition by programming language.</p>
                    </div>
                </div>
            </div>

            {/* Getting Started Section */}
            <div className="getting_started_section">
                <h2 className="section_heading">How to Try It Out</h2>
                <div className="steps_container">
                    <div className="step_card">
                        <div className="step_number">1</div>
                        <h3>Sign Up</h3>
                        <p>Create a free account to get your API key and start experimenting.</p>
                    </div>
                    <div className="step_arrow">→</div>
                    <div className="step_card">
                        <div className="step_number">2</div>
                        <h3>Get the Client</h3>
                        <p>Download the custom VCS client to interact with the platform.</p>
                    </div>
                    <div className="step_arrow">→</div>
                    <div className="step_card">
                        <div className="step_number">3</div>
                        <h3>Push & Explore</h3>
                        <p>Start pushing code and exploring the features!</p>
                    </div>
                </div>
            </div>

            {/* CTA Section */}
            <div className="cta_section">
                <h2>Interested in the Code?</h2>
                <p>This is an open-source learning project. Check out the source code to see how it works!</p>
                <div className="cta_buttons">
                    <a href="https://github.com/schallten/pmg" target="_blank" rel="noopener noreferrer" className="cta_button primary">View on GitHub</a>
                </div>
            </div>
        </>
    )
}