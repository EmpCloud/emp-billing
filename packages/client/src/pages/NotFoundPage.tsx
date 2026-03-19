import { Link } from "react-router-dom";
import { Button } from "@/components/common/Button";
import { Home } from "lucide-react";

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6">
      <h1 className="text-6xl font-bold text-gray-300 mb-4">404</h1>
      <h2 className="text-xl font-semibold text-gray-700 mb-2">Page Not Found</h2>
      <p className="text-gray-500 mb-6">The page you're looking for doesn't exist or has been moved.</p>
      <Link to="/dashboard">
        <Button icon={<Home className="h-4 w-4" />}>Back to Dashboard</Button>
      </Link>
    </div>
  );
}
