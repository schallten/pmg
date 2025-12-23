import React from "react";
import { Link } from "react-router-dom";

export default function Hero() {
    return (
        <>
            <div className="hero">
                <img src="https://plus.unsplash.com/premium_photo-1665329006421-4e945f91885f?q=80&w=687&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D" className="hero_left_image" />
                <div className="hero_right_text">
                    <h3>PMG: An Educational Experiment</h3>
                    <p className="hero_reframing">
                        PMG is an educational experiment in building a vertically integrated developer platform.
                        The project explores version control internals, client–server synchronization, static hosting, and tooling integration by intentionally re-implementing simplified versions of systems like Git, GitHub Pages, and web-based IDEs.
                        PMG prioritizes clarity, debuggability, and architectural learning over feature completeness or production scalability.
                    </p>
                </div>
            </div>

            {/* Non-Goals Section */}
            <div className="features_section">
                <h2 className="section_heading">Explicit Non-Goals</h2>
                <p className="section_subtext">This is defensive engineering documentation. PMG does not try to solve:</p>
                <div className="features_grid non_goals_grid">
                    <div className="feature_card">
                        <h3>Full Git Compatibility</h3>
                        <p>No branching, rebasing, or DAG-based history. We focus on linear progression.</p>
                    </div>
                    <div className="feature_card">
                        <h3>Offline-First Workflows</h3>
                        <p>Designed for direct client-server sync rather than distributed peer-to-peer workflows.</p>
                    </div>
                    <div className="feature_card">
                        <h3>Production Scalability</h3>
                        <p>Not optimized for large-scale repositories or high-concurrency performance.</p>
                    </div>
                    <div className="feature_card">
                        <h3>Enterprise Security</h3>
                        <p>Guarantees are for learning, not for production-grade security or multi-user collaboration.</p>
                    </div>
                </div>
            </div>

            {/* Design Trade-offs Section */}
            <div className="features_section">
                <h2 className="section_heading">Design Trade-offs</h2>
                <div className="features_grid">
                    <div className="feature_card">
                        <h3>Linear History Model</h3>
                        <p>Chosen to simplify sync semantics and make divergence detection explicit. Avoids the complexity of DAG traversal while highlighting why Git uses it.</p>
                    </div>
                    <div className="feature_card">
                        <h3>Folder-based Naming</h3>
                        <p>The system prioritizes the containing folder's name for repository identification, emphasizing the link between local structure and remote state.</p>
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
                        <p>Start pushing code and exploring the architecture!</p>
                    </div>
                </div>
            </div>

            {/* CTA Section */}
            <div className="cta_section">
                <h2>Ready to Start?</h2>
                <p>Check out our documentation to learn how to use the PMG VCS client and deploy your first project.</p>
                <div className="cta_buttons">
                    <Link to="/docs" className="cta_button primary">Read Documentation</Link>
                    <a href="https://github.com/schallten/pmg" target="_blank" rel="noopener noreferrer" className="cta_button secondary">View on GitHub</a>
                </div>
            </div>
        </>
    )
}