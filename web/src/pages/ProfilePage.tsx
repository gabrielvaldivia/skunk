import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  updatePlayer,
  deletePlayer,
  getMatchesForPlayer,
  deleteMatch,
  getPlayers,
} from "../services/databaseService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ThemeToggle } from "../components/theme-toggle";
import { toast } from "sonner";
import "./ProfilePage.css";

export function ProfilePage() {
  const navigate = useNavigate();
  const { player, isAuthenticated, refreshPlayer, signOut } = useAuth();
  const [name, setName] = useState(player?.name || "");
  const [handle, setHandle] = useState(player?.handle || "");
  const [location, setLocation] = useState(player?.location || "");
  const [bio, setBio] = useState(player?.bio || "");
  const [photoPreview, setPhotoPreview] = useState<string | null>(
    player?.photoData ? `data:image/jpeg;base64,${player.photoData}` : null
  );
  const [isSaving, setIsSaving] = useState(false);
  const [handleError, setHandleError] = useState<string | null>(null);
  const [originalPhotoData, setOriginalPhotoData] = useState<string | null>(
    null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generate a color if colorData is not available
  const getPlayerColor = (): string => {
    if (player?.colorData) {
      return player.colorData;
    }
    // Generate a consistent color based on the name hash
    const nameToHash = name || player?.name || "Player";
    const hash = nameToHash
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const hue = hash % 360;
    return `hsl(${hue}, 70%, 60%)`;
  };

  const getInitials = (nameToUse: string): string => {
    return nameToUse
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

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

    // Read file and convert to base64
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Remove data:image/...;base64, prefix
      const base64String = result.split(",")[1];
      setPhotoPreview(result);
      // Store base64 string (without prefix) in a temporary variable
      // We'll use it when saving
      (fileInputRef.current as any).base64Data = base64String;
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setPhotoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      // Set to empty string to indicate photo should be removed
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

    // Check if handle is already taken by another player
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

  const handleSave = async () => {
    if (!player || !isAuthenticated) return;

    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }

    if (!handle.trim()) {
      setHandleError("Handle is required");
      toast.error("Please fill in all required fields");
      return;
    }

    const isValidHandle = await validateHandle(handle);
    if (!isValidHandle) {
      toast.error("Please fix the handle error");
      return;
    }

    setIsSaving(true);

    try {
      const updates: Partial<typeof player> = {
        name: name.trim(),
        handle: handle.trim(),
        location: location.trim() || undefined,
        bio: bio.trim() || undefined,
      };

      // Include photo data if a new photo was selected or removed
      const newPhotoData = (fileInputRef.current as any)?.base64Data;
      if (newPhotoData !== undefined) {
        // Empty string means remove photo, otherwise set the new photo data
        updates.photoData = newPhotoData === "" ? undefined : newPhotoData;
      }

      await updatePlayer(player.id, updates);
      toast.success("Profile saved successfully!");

      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
        (fileInputRef.current as any).base64Data = undefined;
      }

      // Update original photo data to reflect the saved state
      if (updates.photoData === undefined && !player.photoData) {
        setOriginalPhotoData(null);
      } else if (updates.photoData) {
        setOriginalPhotoData(updates.photoData);
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

    // Check handle
    if (handle.trim() !== (player.handle || "")) return true;

    // Check location
    const currentLocation = location.trim();
    const originalLocation = player.location || "";
    if (currentLocation !== originalLocation) return true;

    // Check bio
    const currentBio = bio.trim();
    const originalBio = player.bio || "";
    if (currentBio !== originalBio) return true;

    // Check photo
    const newPhotoData = (fileInputRef.current as any)?.base64Data;
    if (newPhotoData !== undefined) {
      if (newPhotoData === "" && originalPhotoData) return true; // Photo was removed
      if (newPhotoData !== "" && newPhotoData !== originalPhotoData)
        return true; // Photo was changed
    }

    return false;
  };

  // Update fields when player changes
  useEffect(() => {
    if (player) {
      if (player.name) setName(player.name);
      if (player.handle) setHandle(player.handle);
      if (player.location) setLocation(player.location);
      if (player.bio) setBio(player.bio);
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

  const backgroundColor = getPlayerColor();
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
      "- Your player profile\n" +
      "- All matches you participated in\n\n" +
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
      // Get all matches where this player participated
      const playerMatches = await getMatchesForPlayer(player.id);

      // Delete all matches
      for (const match of playerMatches) {
        try {
          await deleteMatch(match.id);
        } catch (error) {
          console.error(`Error deleting match ${match.id}:`, error);
        }
      }

      // Delete the player account
      await deletePlayer(player.id);

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
      <div className="page-header">
        <h1>Account</h1>
      </div>

      <div className="profile-content">
        {/* Profile Info Container */}
        <div className="profile-section">
          <div className="profile-form">
            <div className="form-group">
              <div className="profile-avatar-container">
                <div className="profile-avatar" style={{ backgroundColor }}>
                  {photoPreview ? (
                    <img src={photoPreview} alt={displayName} />
                  ) : (
                    <span className="profile-initials">
                      {getInitials(displayName)}
                    </span>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  style={{ display: "none" }}
                  id="photo-upload"
                />
                <div className="avatar-actions">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Change Photo
                  </Button>
                  {photoPreview && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRemovePhoto}
                    >
                      Remove Photo
                    </Button>
                  )}
                </div>
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
              />
            </div>

            <div className="form-group">
              <Label htmlFor="handle">
                @Handle <span className="required">*</span>
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
                placeholder="yourhandle"
              />
              {handleError && <span className="error-text">{handleError}</span>}
              <span className="form-hint">
                Your unique handle for your profile link
              </span>
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
          </div>

          <div className="profile-section-footer">
            <Button
              onClick={handleSave}
              disabled={
                isSaving || !name.trim() || !handle.trim() || !hasChanges()
              }
            >
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>

        {/* Theme Container */}
        <div className="profile-section">
          <div className="form-group">
            <label>Theme</label>
            <div className="theme-toggle-container">
              <ThemeToggle />
            </div>
          </div>
        </div>

        {/* Danger Zone Container */}
        <div className="profile-section danger-zone-section">
          <div className="danger-zone">
            <h3>Danger Zone</h3>
            <p className="danger-zone-description">
              Deleting your account will permanently remove your profile and all
              matches you participated in.
            </p>
            <div className="danger-zone-actions">
              <Button
                onClick={handleSignOut}
                variant="outline"
                className="sign-out-button"
              >
                Sign Out
              </Button>
              <Button
                onClick={handleDeleteAccount}
                variant="destructive"
                className="delete-account-button"
              >
                Delete Account
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
