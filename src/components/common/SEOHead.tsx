import React, { useEffect } from 'react';

interface SEOHeadProps {
    title: string;
    description: string;
    canonicalUrl: string;
    ogImage?: string;
    noindex?: boolean;
}

export const SEOHead: React.FC<SEOHeadProps> = ({
    title,
    description,
    canonicalUrl,
    ogImage = 'https://udfonline.in/pwa-512x512.png',
    noindex = false
}) => {
    useEffect(() => {
        // 1. Update Document Title
        document.title = title;

        // Helper to create or update meta/link tags
        const setMetaTag = (selector: string, attrName: string, attrValue: string, contentName: string, contentValue: string) => {
            let el = document.querySelector(selector) as HTMLElement | null;
            if (!el) {
                el = document.createElement(selector.startsWith('link') ? 'link' : 'meta');
                document.head.appendChild(el);
            }
            el.setAttribute(attrName, attrValue);
            el.setAttribute(contentName, contentValue);
        };

        // 2. Update Canonical Link
        let canonicalEl = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
        if (!canonicalEl) {
            canonicalEl = document.createElement('link');
            canonicalEl.setAttribute('rel', 'canonical');
            document.head.appendChild(canonicalEl);
        }
        canonicalEl.setAttribute('href', canonicalUrl);

        // 3. Update Meta Description
        setMetaTag('meta[name="description"]', 'name', 'description', 'content', description);

        // 4. Update OpenGraph Tags
        setMetaTag('meta[property="og:title"]', 'property', 'og:title', 'content', title);
        setMetaTag('meta[property="og:description"]', 'property', 'og:description', 'content', description);
        setMetaTag('meta[property="og:url"]', 'property', 'og:url', 'content', canonicalUrl);
        setMetaTag('meta[property="og:image"]', 'property', 'og:image', 'content', ogImage);

        // 5. Update Twitter Card Tags
        setMetaTag('meta[name="twitter:card"]', 'name', 'twitter:card', 'content', 'summary_large_image');
        setMetaTag('meta[name="twitter:title"]', 'name', 'twitter:title', 'content', title);
        setMetaTag('meta[name="twitter:description"]', 'name', 'twitter:description', 'content', description);
        setMetaTag('meta[name="twitter:image"]', 'name', 'twitter:image', 'content', ogImage);

        // 5. Robots Noindex/Index
        let robotsEl = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
        if (!robotsEl) {
            robotsEl = document.createElement('meta');
            robotsEl.setAttribute('name', 'robots');
            document.head.appendChild(robotsEl);
        }
        robotsEl.setAttribute('content', noindex ? 'noindex, nofollow' : 'index, follow');

    }, [title, description, canonicalUrl, ogImage, noindex]);

    return null;
};

export default SEOHead;
