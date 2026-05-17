import TactilePainLogger from "./TactilePainLogger";

interface PainLoggerProps {
  currentPain: {
    score: number;
    severity: string;
    tags?: string[];
    note?: string;
  } | null;
}

export default function PainLogger({ currentPain }: PainLoggerProps) {
  return <TactilePainLogger currentPain={currentPain} />;
}
