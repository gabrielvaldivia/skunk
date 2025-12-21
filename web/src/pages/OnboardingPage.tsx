import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { X, Plus } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { updatePlayer, getPlayers } from "../services/databaseService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import "./OnboardingPage.css";

export function OnboardingPage() {
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const { user, player, refreshPlayer } = useAuth();
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [location, setLocation] = useState("");
  const [bio, setBio] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handleError, setHandleError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Prefill name from Google account
  useEffect(() => {
    if (user?.displayName) {
      setName(user.displayName);
    } else if (player?.name) {
      setName(player.name);
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

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      setPhotoPreview(result);
      (fileInputRef.current as any).base64Data = result.split(",")[1];
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setPhotoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      (fileInputRef.current as any).base64Data = "";
    }
  };

  const validateHandle = async (handleValue: string): Promise<boolean> => {
    if (!handleValue.trim()) {
      setHandleError("Handle is required");
      return false;
    }

    // Validate handle format (alphanumeric, underscore, hyphen, no spaces)
    const handleRegex = /^[a-zA-Z0-9_-]+$/;
    if (!handleRegex.test(handleValue)) {
      setHandleError(
        "Handle can only contain letters, numbers, underscores, and hyphens"
      );
      return false;
    }

    // Check if handle is already taken
    if (player) {
      const allPlayers = await getPlayers();
      const handleTaken = allPlayers.some(
        (p) =>
          p.id !== player.id &&
          p.handle?.toLowerCase() === handleValue.toLowerCase()
      );
      if (handleTaken) {
        setHandleError("This handle is already taken");
        return false;
      }
    }

    setHandleError(null);
    return true;
  };

  const handleHandleBlur = async () => {
    if (handle.trim()) {
      await validateHandle(handle);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!player || !name.trim()) {
      setError("Name is required");
      return;
    }

    if (!handle.trim()) {
      setHandleError("Handle is required");
      return;
    }

    const isValidHandle = await validateHandle(handle);
    if (!isValidHandle) {
      return;
    }

    setIsSaving(true);

    try {
      const updates: Partial<typeof player> = {
        name: name.trim(),
        handle: handle.trim(),
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

      const newPhotoData = (fileInputRef.current as any)?.base64Data;
      if (newPhotoData !== undefined) {
        // Only include photoData if it has a value (empty string means no change or remove)
        if (newPhotoData !== "") {
          updates.photoData = newPhotoData;
        }
      }

      await updatePlayer(player.id, updates);
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
          <X className="h-5 w-5" />
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
                    <Plus className="onboarding-plus-icon" />
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
            <Label htmlFor="handle">
              Username <span className="required">*</span>
            </Label>
            <Input
              id="handle"
              type="text"
              value={handle}
              onChange={(e) => {
                const value = e.target.value.replace(/[^a-zA-Z0-9_-]/g, "");
                setHandle(value);
                if (handleError) {
                  setHandleError(null);
                }
              }}
              onBlur={handleHandleBlur}
              placeholder="username"
              required
            />
            {handleError && <span className="error-text">{handleError}</span>}
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
              disabled={isSaving || !name.trim() || !handle.trim()}
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
