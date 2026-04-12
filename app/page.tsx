import { redirect } from 'next/navigation';

// Root page redirects to account connect
export default function Home() {
  redirect('/accounts/connect');
}
