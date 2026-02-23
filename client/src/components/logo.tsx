import logoSrc from "@assets/1771839445006_1771839521205.png";

interface LogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  className?: string;
}

const sizeMap = {
  sm: "h-6 w-6",
  md: "h-8 w-8",
  lg: "h-10 w-10",
  xl: "h-14 w-14",
};

export function Logo({ size = "md", showText = true, className = "" }: LogoProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <img
        src={logoSrc}
        alt="TenantAdvocate"
        className={`${sizeMap[size]} rounded-full object-contain drop-shadow-sm`}
        data-testid="img-logo"
      />
      {showText && (
        <span className="font-serif font-bold text-foreground tracking-tight whitespace-nowrap">
          TenantAdvocate
        </span>
      )}
    </div>
  );
}

export { logoSrc };
