import { NavBar } from "../components/NavBar";
import { ReviewQueue } from "../components/ReviewQueue";

/** Admin: new games, uploaded photos and reports waiting for a decision */
export function ReviewPage() {
  return (
    <div className="profile-page">
      <NavBar title="Review" />
      <div className="profile-content page-content">
        <section className="profile-group">
          <ReviewQueue />
        </section>
      </div>
    </div>
  );
}
