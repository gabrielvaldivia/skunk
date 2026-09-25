import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

interface ScoreInputProps {
  id?: string;
  isBinary: boolean; // Win/loss toggle instead of a numeric score
  value: number | undefined;
  onChange: (value: number) => void;
  onMarkWinner: () => void;
}

export function ScoreInput({ id, isBinary, value, onChange, onMarkWinner }: ScoreInputProps) {
  if (isBinary) {
    return (
      <Switch
        checked={value === 1}
        onCheckedChange={(checked) => (checked ? onMarkWinner() : onChange(0))}
      />
    );
  }
  return (
    <Input
      id={id}
      type="number"
      min="0"
      value={value || 0}
      onChange={(e) => onChange(parseInt(e.target.value) || 0)}
      placeholder="Score"
      className="w-24"
    />
  );
}
