import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAF8]">
      <SignUp
        appearance={{
          elements: {
            rootBox: 'shadow-none',
            card: 'shadow-sm border border-[#E8E4DC] rounded-xl',
          },
        }}
      />
    </div>
  );
}
