import { cn } from "@/lib/utils";

type AppCopyrightProps = {
  className?: string;
  variant?: "full" | "contact" | "copyright";
};

export function AppCopyright({ className, variant = "full" }: AppCopyrightProps) {
  const showContact = variant === "full" || variant === "contact";
  const showCopyright = variant === "full" || variant === "copyright";

  return (
    <footer className={cn("text-center text-xs leading-relaxed text-muted-foreground", className)}>
      {showContact && (
        <p className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-2 gap-y-1">
          <span>For Software Enquiries, Contact:</span>
          <span className="font-medium text-foreground">
            <a href="tel:+919284834754" className="hover:text-primary">+91 92848 34754</a>
            <span className="mx-2 text-muted-foreground">|</span>
            <a href="tel:+919823251105" className="hover:text-primary">+91 98232 51105</a>
          </span>
        </p>
      )}
      {showCopyright && (
        <p className={cn("mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-2 gap-y-1 font-normal text-foreground", showContact && "mt-1")}>
          <span>Copyright Reserved by Mokashi's Software</span>
          <span className="hidden sm:inline">|</span>
          <span>Designed &amp; Developed by Amol Atole</span>
        </p>
      )}
    </footer>
  );
}
