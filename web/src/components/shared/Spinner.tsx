interface Props {
  size?: "sm" | "md" | "lg";
  color?: string;
  className?: string;
}

const SIZES = { sm: "h-5 w-5 border-3", md: "h-6 w-6 border-3", lg: "h-8 w-8 border-4" };

export default function Spinner({ size = "lg", color = "border-indigo-600", className = "" }: Props) {
  return (
    <div className={`flex justify-center py-8 ${className}`}>
      <div className={`${SIZES[size]} animate-spin rounded-full ${color} border-t-transparent`} />
    </div>
  );
}
