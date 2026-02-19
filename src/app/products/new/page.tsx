import Link from 'next/link';
import { CreateProductForm } from './CreateProductForm';

export default function NewProductPage() {
  return (
    <div className="mx-auto max-w-xl space-y-8 fade-up">
      <div>
        <Link
          href="/"
          className="text-[14px] text-[var(--text-secondary)] transition-colors hover:text-[var(--text)]"
        >
          ← Dashboard
        </Link>
      </div>

      <div>
        <h1
          className="text-2xl font-semibold text-[var(--text)]"
          style={{ fontFamily: 'Space Grotesk, sans-serif' }}
        >
          Create New Product
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Add a new product to start PMF testing
        </p>
      </div>

      <CreateProductForm />
    </div>
  );
}
