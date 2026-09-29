import { NavBar } from "../components/NavBar";
import "./LegalPage.css";

const CONTACT = "gabe@valdivia.works";
const UPDATED = "September 28, 2026";

function Privacy() {
  return (
    <>
      <p className="legal-updated">Last updated {UPDATED}</p>
      <p>
        Skunk is a free app for keeping score at game night. This page explains what we collect, who can see it,
        and how to delete it.
      </p>
      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Your Google sign-in:</strong> your name, email address and Google account ID. Your email stays
          private: only you see it.
        </li>
        <li>
          <strong>Your profile:</strong> the name, photo, location and bio you choose to add.
        </li>
        <li>
          <strong>What you record:</strong> games you add, matches and scores, game nights, and the games and players
          you follow.
        </li>
        <li>
          <strong>Box photos you scan:</strong> when you scan a box cover, the photo is sent to Anthropic's AI to read
          the title. It isn't stored unless you save it as the game's cover.
        </li>
      </ul>
      <h2>Who can see it</h2>
      <p>
        Skunk is social. Your profile, the games you add, and matches you play in are visible to everyone who uses
        Skunk. New games and uploaded photos are checked by us before other people see them.
      </p>
      <h2>Who processes it</h2>
      <p>
        Data is stored with Google Firebase and the site is hosted by Vercel. Cover scans are processed by Anthropic.
        Game information and cover art come from BoardGameGeek. We don't sell your data, show ads, or share it with
        anyone else.
      </p>
      <h2>Deleting your data</h2>
      <p>
        Delete your account from the Account page at any time. Your profile, photo and personal details are removed;
        matches you played in stay for the other players, under "Deleted player". For anything else, email{" "}
        <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
      </p>
      <h2>Children</h2>
      <p>Skunk isn't for children under 13, and we don't knowingly collect their data.</p>
      <h2>Changes</h2>
      <p>If this policy changes, we'll update this page and the date above.</p>
    </>
  );
}

function Terms() {
  return (
    <>
      <p className="legal-updated">Last updated {UPDATED}</p>
      <p>By using Skunk you agree to these terms. If you don't agree, please don't use it.</p>
      <h2>Who can use Skunk</h2>
      <p>You must be at least 13 years old.</p>
      <h2>What you post</h2>
      <p>
        You keep ownership of what you add, and give us permission to show it in Skunk. Only post things you have the
        right to share. Don't post anything that is sexual, hateful, harassing, violent, illegal, or someone else's
        private information, and don't use Skunk to spam or to disrupt it for others.
      </p>
      <p>
        We review new games and photos, and may remove anything, or suspend any account, that breaks these rules. We
        report illegal content to the authorities where the law requires it.
      </p>
      <h2>Copyright</h2>
      <p>
        If you believe something on Skunk infringes your copyright, email <a href={`mailto:${CONTACT}`}>{CONTACT}</a>{" "}
        with the content and your claim, and we'll look at it promptly. Game data and cover art are from
        BoardGameGeek and belong to their publishers.
      </p>
      <h2>No warranty</h2>
      <p>
        Skunk is provided as is, for free. We do our best to keep it running and your records safe, but we can't
        promise it will always be available or error-free, and we aren't liable for lost data or other losses from
        using it.
      </p>
      <h2>Changes</h2>
      <p>
        We may update these terms. If we do, we'll update this page and the date above. Questions:{" "}
        <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
      </p>
    </>
  );
}

export function LegalPage({ doc }: { doc: "privacy" | "terms" }) {
  return (
    <div className="legal-page">
      <NavBar title={doc === "privacy" ? "Privacy Policy" : "Terms of Service"} />
      <div className="page-content legal-content">{doc === "privacy" ? <Privacy /> : <Terms />}</div>
    </div>
  );
}
