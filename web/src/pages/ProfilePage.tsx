import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { usePlayersData } from "../context/DataCacheContext";
import {
  updatePlayer,
  anonymizePlayer,
  submitImage,
  rejectImage,
} from "../services/databaseService";
import { useReviewQueue } from "../context/DataCacheContext";
import { useReviewCount } from "../components/ReviewQueue";
import { usePanelFrame } from "../context/PanelContext";
import type { FieldUpdates } from "../services/databaseService";
import type { Player } from "../models/Player";
import { CameraIcon } from "../components/icons";
import { Button } from "@/components/ui/button";
import { NavBar } from "../components/NavBar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ThemeToggle } from "../components/theme-toggle";
import { toast } from "sonner";
import "./ProfilePage.css";
import { isAdminEmail } from "@/lib/admin";
import { squarePhotoBase64 } from "@/lib/photo";

export function ProfilePage() {
  const navigate = useNavigate();
  const { user, player, isAuthenticated, refreshPlayer, signOut } = useAuth();
  const { refreshPlayers } = usePlayersData();
  const frame = usePanelFrame();
  const reviewCount = useReviewCount();
  const isAdmin = isAdminEmail(user?.email);
  const [name, setName] = useState(player?.name || "");
  const [location, setLocation] = useState(player?.location || "");
  const [bio, setBio] = useState(player?.bio || "");
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    player?.photoData ? `data:image/jpeg;base64,${player.photoData}` : null
  );
  const [isSaving, setIsSaving] = useState(false);
  const [originalPhotoData, setOriginalPhotoData] = useState<string | null>(
    null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  // undefined = unchanged, null = remove, string = new base64 photo (no data: prefix)
  const [pendingPhotoData, setPendingPhotoData] = useState<string | null | undefined>(undefined);
  // A new photo waits for the admin before others see it
  const { myPending } = useReviewQueue();
  const photoInReview = myPending.find((p) => p.kind === "player" && p.targetId === player?.id);
  const shownPhoto =
    pendingPhotoData === undefined && photoInReview ? `data:image/jpeg;base64,${photoInReview.image}` : photoPreview;

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("Image size must be less than 5MB");
      return;
    }

    // Shrink to the stored avatar size, so the player record stays small
    const url = URL.createObjectURL(file);
    squarePhotoBase64(url)
      .then((base64String) => {
        setPhotoPreview(`data:image/jpeg;base64,${base64String}`);
        setPendingPhotoData(base64String);
      })
      .catch(() => alert("Couldn't read that image"))
      .finally(() => URL.revokeObjectURL(url));
  };

  const handleRemovePhoto = () => {
    setPhotoPreview(null);
    setPendingPhotoData(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    if (!player || !isAuthenticated) return;

    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }

    setIsSaving(true);

    try {
      // Empty fields are sent as null so clearing them actually removes them
      const updates: FieldUpdates<Player> = {
        name: name.trim(),
        location: location.trim() || null,
        bio: bio.trim() || null,
      };
      if (typeof pendingPhotoData === "string" && !isAdmin) {
        await submitImage("player", player.id, pendingPhotoData, user!.uid);
      } else if (pendingPhotoData !== undefined) {
        updates.photoData = pendingPhotoData;
        if (pendingPhotoData === null && photoInReview) await rejectImage(photoInReview);
      }

      await updatePlayer(player.id, updates);
      await refreshPlayers();
      toast.success("Profile saved successfully!");

      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      if (pendingPhotoData !== undefined) {
        setOriginalPhotoData(pendingPhotoData);
        setPendingPhotoData(undefined);
      }

      // Refresh player data from AuthContext
      await refreshPlayer();
    } catch (error) {
      console.error("Error saving profile:", error);
      toast.error("Error saving profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // Check if there are any changes
  const hasChanges = () => {
    if (!player) return false;

    // Check name
    if (name.trim() !== (player.name || "")) return true;

    // Check location
    const currentLocation = location.trim();
    const originalLocation = player.location || "";
    if (currentLocation !== originalLocation) return true;

    // Check bio
    const currentBio = bio.trim();
    const originalBio = player.bio || "";
    if (currentBio !== originalBio) return true;

    // Check photo
    if (pendingPhotoData !== undefined && pendingPhotoData !== originalPhotoData) {
      return true; // Photo was changed or removed
    }

    return false;
  };

  // Update fields when player changes
  useEffect(() => {
    if (player) {
      setName(player.name || "");
      setLocation(player.location || "");
      setBio(player.bio || "");
      if (player.photoData) {
        setPhotoPreview(`data:image/jpeg;base64,${player.photoData}`);
        setOriginalPhotoData(player.photoData);
      } else {
        setPhotoPreview(null);
        setOriginalPhotoData(null);
      }
    }
  }, [player]);

  if (!isAuthenticated) {
    return (
      <div className="profile-page">
        <div className="empty-state">
          <p>Please sign in to view your profile</p>
        </div>
      </div>
    );
  }

  if (!player) {
    return (
      <div className="profile-page">
        <div className="loading">Loading profile...</div>
      </div>
    );
  }

  const displayName = name.trim() || player.name || "Player";

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/signin");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const handleDeleteAccount = async () => {
    if (!player) return;

    const confirmMessage =
      "Are you sure you want to delete your account? This will permanently delete:\n\n" +
      "- Your name, photo, email and profile details\n\n" +
      "Matches you played will remain for the other players, credited to \"Deleted player\".\n\n" +
      "This action cannot be undone.";

    if (!window.confirm(confirmMessage)) {
      return;
    }

    // Double confirmation
    if (
      !window.confirm(
        "This is your last chance to cancel. Are you absolutely sure you want to delete your account?"
      )
    ) {
      return;
    }

    try {
      // Anonymize rather than delete so other players' match history stays intact
      if (photoInReview) await rejectImage(photoInReview);
      await anonymizePlayer(player.id);

      // Sign out and redirect to sign in page
      await signOut();
      navigate("/signin");
    } catch (error) {
      console.error("Error deleting account:", error);
      alert("Failed to delete account. Please try again.");
    }
  };

  return (
    <div className="profile-page">
      <NavBar title="Account" closeInCorner />

      <div className="profile-content page-content">
        <div className="profile-avatar-container">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
            style={{ display: "none" }}
            id="photo-upload"
          />
          <button
            type="button"
            className="profile-avatar-button"
            onClick={() => fileInputRef.current?.click()}
            aria-label={shownPhoto ? "Change photo" : "Add photo"}
          >
            {shownPhoto ? (
              <img src={shownPhoto} alt={displayName} />
            ) : (
              <span className="profile-avatar-placeholder">
                <CameraIcon className="profile-plus-icon" />
              </span>
            )}
          </button>
          {shownPhoto && (
            <button type="button" className="text-button" onClick={handleRemovePhoto}>
              Remove photo
            </button>
          )}
          {photoInReview && pendingPhotoData === undefined && (
            <p className="profile-email">Photo waiting for review · others see it once it's approved</p>
          )}
          {user?.email && (
            <p className="profile-email">
              {user.email}
              {isAdmin && <span className="profile-admin-badge">Admin</span>}
            </p>
          )}
        </div>

        <section className="profile-group">
          <div className="form-group">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </div>

          <div className="form-group">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="City, Country"
            />
          </div>

          <div className="form-group">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell us about yourself"
              rows={3}
            />
          </div>

          <Button
            onClick={handleSave}
            disabled={isSaving || !name.trim() || !hasChanges()}
            className="w-full"
          >
            {isSaving ? "Saving..." : "Save changes"}
          </Button>
        </section>

        <section className="profile-group profile-row">
          <span className="profile-row-label">Appearance</span>
          <ThemeToggle />
        </section>

        {isAdmin && (
          <section className="profile-group">
            <div>
              <h2 className="profile-group-title">Admin tools</h2>
            </div>
            <div className="profile-actions">
              <Button variant="secondary" onClick={() => (frame ? frame.open({ type: "review" }) : navigate("/review"))}>
                Review{reviewCount ? ` · ${reviewCount} waiting` : ""}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  // New players get onboarding full screen, on desktop too
                  frame?.close();
                  navigate("/onboarding");
                }}
              >
                Replay onboarding
              </Button>
              <Button
                variant="secondary"
                onClick={() => (frame ? frame.open({ type: "signin", preview: true }) : navigate("/signin?admin=true"))}
              >
                View sign-in screen
              </Button>
            </div>
          </section>
        )}

        <section className="profile-actions">
          <Button onClick={handleSignOut} variant="secondary" className="w-full">
            Sign out
          </Button>
          <Button
            onClick={handleDeleteAccount}
            variant="ghost"
            className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            Delete account
          </Button>
          <p className="form-hint profile-delete-hint">
            Deleting your account removes your name, photo and profile. Your past
            matches stay, credited to "Deleted player".
          </p>
          <p className="form-hint profile-delete-hint">
            <a href="/terms" className="underline">Terms</a> · <a href="/privacy" className="underline">Privacy Policy</a>
          </p>
        </section>
      </div>
    </div>
  );
}
