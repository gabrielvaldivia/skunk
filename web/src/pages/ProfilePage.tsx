import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  updatePlayer,
  anonymizePlayer,
} from "../services/databaseService";
import type { FieldUpdates } from "../services/databaseService";
import type { Player } from "../models/Player";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ThemeToggle } from "../components/theme-toggle";
import { toast } from "sonner";
import "./ProfilePage.css";
import { isAdminEmail } from "@/lib/admin";

export function ProfilePage() {
  const navigate = useNavigate();
  const { user, player, isAuthenticated, refreshPlayer, signOut } = useAuth();
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

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be less than 5MB");
      return;
    }

    // Read file and convert to base64
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Remove data:image/...;base64, prefix
      const base64String = result.split(",")[1];
      setPhotoPreview(result);
      setPendingPhotoData(base64String);
    };
    reader.readAsDataURL(file);
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
      if (pendingPhotoData !== undefined) {
        updates.photoData = pendingPhotoData;
      }

      await updatePlayer(player.id, updates);
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
      await anonymizePlayer(player.id);

      // Sign out and redirect to sign in page
      await signOut();
      navigate("/signin");
    } catch (error) {
      console.error("Error deleting account:", error);
      toast.error("Failed to delete account. Please try again.");
    }
  };

  return (
    <div className="profile-page">
      <div className="page-header">
        <Button variant="outline" onClick={() => navigate(-1)} size="icon" aria-label="Go back">
          <ChevronLeft />
        </Button>
        <h1>Account</h1>
        <div style={{ width: 40 }} />
      </div>

      <div className="profile-content page-content">
        {/* Profile Info Container */}
        <div className="profile-section">
          <div className="profile-form">
            <div className="form-group">
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
                >
                  {photoPreview ? (
                    <img src={photoPreview} alt={displayName} />
                  ) : (
                    <div className="profile-avatar-placeholder">
                      <Plus className="profile-plus-icon" />
                    </div>
                  )}
                </button>
                {photoPreview && (
                  <div className="avatar-actions">
                    <Button
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
          </div>

          <div className="profile-section-footer">
            <Button
              onClick={handleSave}
              disabled={isSaving || !name.trim() || !hasChanges()}
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

        {/* Admin Section */}
        {isAdmin && (
          <div className="profile-section">
            <div className="form-group">
              <h3>Admin Tools</h3>
              <p className="form-hint">Tools for testing and development</p>
              <div className="form-actions">
                <Button
                  variant="outline"
                  onClick={() => navigate("/onboarding")}
                >
                  Replay Onboarding
                </Button>
                <Button
                  variant="outline"
                  onClick={() => navigate("/signin?admin=true")}
                >
                  View Sign In Screen
                </Button>
              </div>
            </div>
          </div>
        )}

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
