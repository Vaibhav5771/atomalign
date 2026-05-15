import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-bold">404</h1>
        <p className="text-muted-foreground">This page does not exist.</p>
        <Button asChild>
          <Link to="/login">Go to login</Link>
        </Button>
      </div>
    </div>
  );
}
