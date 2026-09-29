import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { CameraIcon, CloseIcon } from "../components/icons";
import { useAuth } from "../context/AuthContext";
import { usePlayersData } from "../context/DataCacheContext";
import { updatePlayer, submitImage } from "../services/databaseService";
import { isAdminEmail } from "@/lib/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { squarePhotoBase64 } from "@/lib/photo";
import "./ProfilePage.css";
import "../components/SignInView.css";
import "./OnboardingPage.css";

export function OnboardingPage() {
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const { user, player, refreshPlayer } = useAuth();
  const { refreshPlayers } = usePlayersData();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [bio, setBio] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoData, setPhotoData] = useState<string | null>(null); // base64 without data: prefix

  // Prefill name from Google account, once: the player record updates again
  // (e.g. when the Google photo lands) and mustn't wipe what's been typed
  const prefilled = useRef(false);
  useEffect(() => {
    if (prefilled.current) return;
    const initial = user?.displayName || player?.name;
    if (initial) {
      setName(initial);
      prefilled.current = true;
    }
  }, [user, player]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Image size must be less than 5MB");
      return;
    }

    // Shrink to the stored avatar size, so the player record stays small
    const url = URL.createObjectURL(file);
    squarePhotoBase64(url)
      .then((base64) => {
        setPhotoPreview(`data:image/jpeg;base64,${base64}`);
        setPhotoData(base64);
      })
      .catch(() => setError("Couldn't read that image"))
      .finally(() => URL.revokeObjectURL(url));
  };

  const handleRemovePhoto = () => {
    setPhotoPreview(null);
    setPhotoData(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!player || !name.trim()) {
      setError("Name is required");
      return;
    }

    setIsSaving(true);

    try {
      const updates: Partial<typeof player> = {
        name: name.trim(),
        needsOnboarding: false,
      };

      // Only include location if it has a value
      const trimmedLocation = location.trim();
      if (trimmedLocation) {
        updates.location = trimmedLocation;
      }

      // Only include bio if it has a value
      const trimmedBio = bio.trim();
      if (trimmedBio) {
        updates.bio = trimmedBio;
      }

      // A photo shows to others once the admin has reviewed it
      if (photoData && isAdminEmail(user?.email)) {
        updates.photoData = photoData;
      } else if (photoData && user) {
        await submitImage("player", player.id, photoData, user.uid);
      }

      await updatePlayer(player.id, updates);
      await refreshPlayers();
      await refreshPlayer();

      // Redirect to intended destination or home
      const from =
        (routerLocation.state as { from?: { pathname: string } })?.from
          ?.pathname || "/";
      navigate(from, { replace: true });
    } catch (err) {
      console.error("Error saving profile:", err);
      setError("Couldn't save your profile. Try again.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!player) {
    return (
      <div className="onboarding-page">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  const displayName = name.trim() || player.name || "Player";
  const isAdmin = isAdminEmail(user?.email);

  return (
    <div className="onboarding-page">
      {/* Same round corner button as the sign-in screen */}
      <button type="button" className="sign-in-close-button" onClick={() => navigate("/")} aria-label="Close">
        <CloseIcon size={20} />
      </button>
      <div className="onboarding-container">
        <div className="onboarding-header">
          <div className="sign-in-mark" aria-hidden><img src="/brand/logo.png" alt="" /></div>
          <h1>Welcome to Skunk</h1>
          <p>Set up your profile so friends can find you.</p>
        </div>

        <form onSubmit={handleSubmit} className="onboarding-form">
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
              aria-label={photoPreview ? "Change photo" : "Add photo"}
            >
              {photoPreview ? (
                <img src={photoPreview} alt={displayName} />
              ) : (
                <span className="profile-avatar-placeholder">
                  <CameraIcon className="profile-plus-icon" />
                </span>
              )}
            </button>
            {photoPreview ? (
              <button type="button" className="text-button" onClick={handleRemovePhoto}>
                Remove photo
              </button>
            ) : (
              <span className="form-hint">Add a photo</span>
            )}
            {photoPreview && !isAdmin && (
              <p className="form-hint onboarding-photo-hint">Others see your photo once it's reviewed.</p>
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
                required
              />
            </div>

            <div className="form-group">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Brooklyn, NY"
              />
            </div>

            <div className="form-group">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Favorite games, house rules, rivalries"
                rows={3}
              />
            </div>
          </section>

          {error && <p className="error-message">{error}</p>}

          <Button type="submit" disabled={isSaving || !name.trim()} size="lg" className="w-full">
            {isSaving ? "Saving..." : "Get started"}
          </Button>
        </form>
      </div>
    </div>
  );
}
