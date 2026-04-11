import { redirect } from 'next/navigation';

// Root page redirects to the marketing landing page
export default function Home() {
  redirect('/accounts/connect?demo=1');
}
