import AuthModal from './NoAuth.jsx';
import useStore from '../store.js';

export default function PinGate({ children }) {
  const user = useStore((s) => s.user);

  if (!user) return children;

  if (user.has_pin === true) {
    if (typeof window !== 'undefined' && window.sessionStorage?.getItem('pinUnlocked') === '1') {
      return children;
    }
    return <AuthModal initialStep="pin" onClose={() => {}} dismissable={false} />;
  }

  // user.has_pin === false → need to set a PIN
  return <AuthModal initialStep="set-pin" onClose={() => {}} dismissable={false} />;
}
