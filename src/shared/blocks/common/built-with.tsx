import { Link } from '@/core/i18n/navigation';
import { Button } from '@/shared/components/ui/button';

export function BuiltWith() {
  return (
    <Button asChild variant="outline" size="sm" className="hover:bg-primary/10">
      <Link href="/contact">support@removegeminiwatermark.org</Link>
    </Button>
  );
}
