import "./Home.css";

export default function Home() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "1rem",
        fontFamily: "system-ui, -apple-system, sans-serif",
        maxWidth: "1000px",
        margin: "0 auto",
        textAlign: "center",
      }}
    >
      {/* <------- HEADER SECTION -------> */}
      <div>
        <h1>
          <img
            src="https://icnyvghgspgzemdudsrd.supabase.co/storage/v1/object/public/global/logo.png"
            alt="Meerkat"
            style={{ width: "50px", height: "50px" }}
          />
          eerkat - the privacy preserving audience engagement app
        </h1>
      </div>
      <div>
        <h2>The easy to use Q&A App for Attendees</h2>
      </div>
      <div>
        <h1>Attendees follow just two steps</h1>
        <p>
          Scan your talk's or panel's QR code, and immediately, you can
          contribute questions throughout the talk.
        </p>
      </div>
      {/* Container for iframes */}
      <div
        style={{
          display: "flex",
          gap: "1rem",
          width: "100%",
          flexDirection: "row",
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        {/* Left Panel */}
        <div
          style={{
            flex: "1 1 48%",
            minWidth: "300px",
            padding: "20px",
            boxSizing: "border-box",
          }}
        >
          <p style={{ fontSize: "1.2em", marginBottom: "10px" }}>
            1. Scan QR Code
          </p>
          <div
            style={{
              width: "100%",
              height:
                "85vh", /* Updated to use relative height for better adaptability */
              boxShadow: "0 0 10px rgba(0, 0, 0, 0.1)",
              overflow: "hidden",
            }}
          >
            <iframe
              title="QR Code Scan"
              src="https://meerkat.events/e/feedback/remote"
              style={{ width: "100%", height: "100%", border: "none" }}
            >
              Your browser does not support iframes.
            </iframe>
          </div>
        </div>
        {/* Right Panel */}
        <div
          style={{
            flex: "1 1 48%",
            minWidth: "300px",
            padding: "20px",
            boxSizing: "border-box",
          }}
        >
          <p style={{ fontSize: "1.2em", marginBottom: "10px" }}>
            2. Ask a question, upvote and like.
          </p>
          <div
            style={{
              width: "100%",
              height:
                "85vh", /* Updated to use relative height for better adaptability */
              boxShadow: "0 0 10px rgba(0, 0, 0, 0.1)",
              overflow: "hidden",
            }}
          >
            <iframe
              title="Ask a Question"
              src="https://meerkat.events/e/feedback/qa"
              style={{ width: "100%", height: "100%", border: "none" }}
            >
              Your browser does not support iframes.
            </iframe>
          </div>
        </div>
      </div>

      {/* Additional Content */}
      <div>
        <h1>Useful functions for you as the Organizer</h1>
        <p>
          Your audio-visual controller or MC can moderate the most upvoted
          questions, mark questions as answered and prevent spam.
        </p>
      </div>
      <div>
        <h1>
          Meerkat makes your audience and speaker relationship closer and easier
        </h1>
        <p>
          A dedicated way to ensure the most important questions are answered
          and to engage with your audience.
        </p>
      </div>
      <div>
        <h1>Meerkat uses zero-knowledge technology</h1>
        <p>
          It offers a Q&A feature that can be used fully anonymous, or used with
          Zupass zk-credentials manager to different permission levels.
        </p>
      </div>
      <div>
        <h1>Meerkat is Open Source software</h1>
        <p>
          We can host your events' talks and panels, or you can clone our repo
          and host your own Meerkat instance{"  "}
          <a href="https://github.com/meerkat-events/meerkat">
            @meerkat on Github
          </a>
        </p>
      </div>
      <div>
        <h1>Speakers and attendees collect useable zk Proofs</h1>
        <p>Check into the Leaderboard (coming at Devcon)</p>
      </div>
      <div>
        <h1>Testimonials</h1>
        <p>
          Powered events by Bitpanda, Worldchain, EthBerlin, EdgeCity Lanna,
          Devcon 7.
        </p>
      </div>
      <div>
        <h1>Meerkat is excited to be a contributor to Devcon 7: DIP-45</h1>
        <p>
          <a href="https://github.com/efdevcon/DIPs/blob/964a14418a40c6202cfee308ff21f1aee54aa831/DIPs/DIP-45.md">
            DIP-45 on EFDevcon @github.com
          </a>
        </p>
        <p>
          <a href="https://forum.devcon.org/t/dip-45-meerkat-q-a-tool-for-audience-engagement/3805">
            DIP-45 on @forum.devcon.org
          </a>
        </p>
      </div>
      <div>
        <h2>Team</h2>
        <p>
          <a href="https://x.com/mcnaclh2o">Miriam</a> &{"  "}
          <a href="https://x.com/fdreschner">Florian</a>, and our amazing
          contributors{"  "}<a href="https://github.com/mycenaean-n">@Matic</a>
          {"  "}
          <a href="https://www.linkedin.com/in/jinnycharoensiri/">@Jinny</a>
        </p>
      </div>
      <div>
        <h1>
          Want to leave us feedback? Just use{"   "}
          <a href="https://meerkat.events/e/FEEDBACK/remote">Meerkat</a>
        </h1>
      </div>
      <div>
        <h2>We love to hear from you</h2>
        <p>
          Reach out to us on Twitter at{"  "}
          <a href="https://x.com/meerkatzk">@meerkatzk</a>
        </p>
      </div>
    </div>
  );
}
