import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { CloseIcon, PlusIcon } from "../components/icons";
import { useAuth } from "../context/AuthContext";
import { usePlayersData } from "../context/DataCacheContext";
import { updatePlayer, submitImage } from "../services/databaseService";
import { isAdminEmail } from "@/lib/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { squarePhotoBase64 } from "@/lib/photo";
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
      setError("Error saving profile. Please try again.");
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

  return (
    <div className="onboarding-page">
      <div className="onboarding-container">
        <Button
          variant="ghost"
          size="icon"
          className="onboarding-close-button"
          onClick={() => navigate("/")}
          aria-label="Close"
        >
          <CloseIcon className="h-5 w-5" />
        </Button>
        <div className="onboarding-header">
          <h1>Welcome to Skunk!</h1>
          <p>Let's set up your profile</p>
        </div>

        <form onSubmit={handleSubmit} className="onboarding-form">
          <div className="onboarding-avatar-section">
            <div className="onboarding-avatar-container">
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
                className="onboarding-avatar-button"
                onClick={() => fileInputRef.current?.click()}
              >
                {photoPreview ? (
                  <img src={photoPreview} alt={displayName} />
                ) : (
                  <div className="onboarding-avatar-placeholder">
                    <PlusIcon className="onboarding-plus-icon" />
                  </div>
                )}
              </button>
              {photoPreview && (
                <div className="avatar-actions">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRemovePhoto}
                  >
                    Remove Photo
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="form-group">
            <Label htmlFor="name">
              Name <span className="required">*</span>
            </Label>
            <Input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
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
              placeholder="City, Country"
            />
          </div>

          <div className="form-group">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell us about yourself..."
              rows={4}
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="form-actions">
            <Button
              type="submit"
              disabled={isSaving || !name.trim()}
              size="lg"
              className="submit-button"
            >
              {isSaving ? "Creating Account..." : "Create Account"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
