# Google AdSense Integration & Backup Reference

> **Status**: AdSense is currently **COMPLETELY DISABLED** across all portals and public pages per admin instruction.  
> Use this file to re-enable Google AdSense whenever you are ready in the future.

---

## 1. Account & Publisher Details
* **Google AdSense Publisher ID**: `ca-pub-4069971667046129`
* **Account Type**: Direct Publisher
* **Root Domain**: `https://udfonline.in`

---

## 2. Ads.txt Record
Location: `public/ads.txt`
```text
google.com, pub-4069971667046129, DIRECT, f08c47fec0942fa0
```

---

## 3. AdSense Global Script Tag
When re-enabling, **ONLY load this script on the public website (`udfonline.in`)**. Never load it on `admin.udfonline.in` or `employee.udfonline.in` (violates Google AdSense login/password-protected policy).

### Safe Loader (in `index.tsx`):
```typescript
// Dynamically load Google AdSense script ONLY on public web builds (main site)
const target = import.meta.env.VITE_APP_TARGET;
if (!target || target === 'public') {
  const script = document.createElement('script');
  script.async = true;
  script.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4069971667046129";
  script.crossOrigin = "anonymous";
  document.head.appendChild(script);
}
```

---

## 4. Reusable Ad Unit Component (`components/common/AdSenseUnit.tsx`)
```tsx
import React, { useEffect, useRef } from 'react';

interface AdSenseUnitProps {
    slot: string;
    format?: string;
    responsive?: boolean;
    style?: React.CSSProperties;
    className?: string;
}

const AdSenseUnit: React.FC<AdSenseUnitProps> = ({
    slot,
    format = 'auto',
    responsive = true,
    style = { display: 'block' },
    className = ''
}) => {
    const initialized = useRef(false);
    const isDev = import.meta.env.DEV || window.location.hostname === 'localhost';

    useEffect(() => {
        if (isDev) return;

        if (!initialized.current) {
            try {
                const adsbygoogle = (window as any).adsbygoogle || [];
                adsbygoogle.push({});
                initialized.current = true;
            } catch (e) {
                console.warn('Google AdSense push failed:', e);
            }
        }
    }, [isDev]);

    if (isDev) {
        return (
            <div className={`my-6 p-4 bg-slate-50 border border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center min-h-[120px] text-center transition-all hover:bg-slate-100 ${className}`}>
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">
                    Advertisement
                </span>
                <span className="text-xs font-semibold text-slate-500">
                    Google AdSense Placeholder (Dev Mode)
                </span>
                <span className="text-[9px] text-slate-400 mt-1 font-mono">
                    Slot ID: {slot} • Format: {format}
                </span>
            </div>
        );
    }

    return (
        <div className={`my-6 overflow-hidden ${className}`}>
            <ins
                className="adsbygoogle"
                style={style}
                data-ad-client="ca-pub-4069971667046129"
                data-ad-slot={slot}
                data-ad-format={format}
                data-full-width-responsive={responsive ? 'true' : 'false'}
            />
        </div>
    );
};

export default AdSenseUnit;
```

---

## 5. Previously Configured Ad Placements
When active, `<AdSenseUnit slot="XXXX" />` was positioned in the following public pages:
1. `components/BlogPage.tsx` (In-article banner & sidebar)
2. `components/BlogsPage.tsx` (Between blog card grid rows)
3. `components/AboutPage.tsx` (Bottom banner)
4. `components/CareersPage.tsx` (Above vacancy listings)
5. `components/ContactPage.tsx` (Bottom footer banner)
6. `components/BusinessSolutionsPage.tsx` / `ServicesPage.tsx` (Services showcase)
7. `components/PrivacyPolicyPage.tsx` & `TermsOfServicePage.tsx` (Legal footer)
