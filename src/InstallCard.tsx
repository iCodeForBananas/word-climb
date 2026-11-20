import { Download, Share, X } from "lucide-react";
import { Button } from "./Button";
import { useInstallOffer } from "./pwa";

// Shown on the start screen of the web version when the game can be
// installed and isn't yet. Nothing shows in the native apps.
export default function InstallCard() {
  const offer = useInstallOffer();
  if (offer.kind === "none") return null;

  return (
    <div className='relative w-full max-w-md rounded-2xl border border-line bg-card p-4 pr-12 text-left'>
      <button
        type='button'
        onClick={offer.dismiss}
        aria-label='Not now'
        className='absolute top-2 right-2 p-2 rounded-md text-ink-muted active:bg-white/10'
      >
        <X className='w-5 h-5' />
      </button>
      <div className='font-bold text-lg mb-1'>Install Word Climb</div>
      {offer.kind === "prompt" ? (
        <>
          <p className='text-ink-muted mb-3'>Put it on your home screen. It opens full screen and works offline.</p>
          <Button variant='primary' size='md' onClick={offer.install}>
            <Download className='w-5 h-5' /> Install
          </Button>
        </>
      ) : (
        <p className='text-ink-muted'>
          Tap <Share className='inline w-5 h-5 -mt-1 text-ink' aria-label='Share' /> in the browser bar, then{" "}
          <span className='text-ink font-bold'>Add to Home Screen</span>. It opens full screen and works offline.
        </p>
      )}
    </div>
  );
}
