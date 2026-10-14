import { db } from '../firebase/config';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { logSystemAction } from './auditService';

export interface WebsiteServiceData {
    aboutIntroTitle: string;
    aboutStoryText1: string;
    aboutStoryText2: string;
    aboutActiveOfficersCount: number;
    aboutSecuredSitesCount: number;
    services: {
        id: string;
        title: string;
        description: string;
        icon: string;
    }[];
    contactAddress: string;
    contactPhone: string;
    contactEmail: string;
    contactHoursWeekdays: string;
    contactHoursSunday: string;
    careersTitle: string;
    careersSubtitle: string;
    careersPitch: string;
    careersBenefits: string[];
}

const DEFAULT_CONFIG: WebsiteServiceData = {
    aboutIntroTitle: 'Securing What Matters Most',
    aboutStoryText1: 'Unique Delta Force Pvt Ltd is a premier security agency established to deliver high-standard protective services to corporate facilities, manufacturing plants, software campuses, and residential sectors.',
    aboutStoryText2: 'We pride ourselves on the discipline of our security personnel, continuous training, on-time salary commitments, and compliance with statutory PF/ESI norms. We don\'t just assign guards; we implement holistic protection plans tailored to client vulnerability parameters.',
    aboutActiveOfficersCount: 15000,
    aboutSecuredSitesCount: 800,
    services: [
        {
            id: 'srv-1',
            title: 'Manned Guarding & Patrols',
            description: 'Highly trained, uniformed security guards providing round-the-clock physical protection, gate access control, and periodic foot patrols.',
            icon: 'Shield'
        },
        {
            id: 'srv-2',
            title: 'CCTV & Alarm Monitoring',
            description: 'Electronic surveillance monitoring from our central control room, verifying perimeter health and reacting to automated trigger alarms.',
            icon: 'Eye'
        },
        {
            id: 'srv-3',
            title: 'VIP & Corporate Escorts',
            description: 'Specialized protective service for executives, delegates, and transit operations requiring high-level situational awareness.',
            icon: 'Users'
        },
        {
            id: 'srv-4',
            title: 'K9 Canine Squad',
            description: 'Certified sniffer and perimeter security dogs (German Shepherds, Rottweilers) handled by experienced handlers under strict animal care and welfare compliance.',
            icon: 'PawPrint'
        },
        {
            id: 'srv-5',
            title: 'Escort Marshall Services',
            description: 'Tailored transport protection for IT/ITES organizations, including certified cab and bus marshalls safeguarding female staff working late-night shifts.',
            icon: 'Car'
        },
        {
            id: 'srv-6',
            title: 'Corporate Event & Crowd Management',
            description: 'Trained bouncers, static guarding, crowd control barriers, and metal detection/baggage screening setups for corporate meetings, concerts, and public exhibitions.',
            icon: 'Calendar'
        },
        {
            id: 'srv-7',
            title: 'Drone & Tech-Enabled Patrols',
            description: 'Modern, airborne surveillance solutions providing comprehensive perimeter monitoring for large industrial sites, integrated with GPS checks.',
            icon: 'Cpu'
        }
    ],
    contactAddress: '123 Security Main Road, Tech Park Area, Madhapur, Hyderabad, Telangana - 500081',
    contactPhone: '+91 98765 43210',
    contactEmail: 'info@udfonline.in',
    contactHoursWeekdays: '10:00 AM - 06:00 PM',
    contactHoursSunday: 'Closed',
    careersTitle: 'Build a Career in Protection and Trust',
    careersSubtitle: 'Explore open security guard and supervisor jobs across our branches with on-time payouts and legal PF/ESI benefits.',
    careersPitch: 'At Unique Delta Force, we believe our officers are our core strength. We provide regular training, career advancement tracks, competitive salaries paid strictly by the 7th of every month, and fully compliant PF and ESI medical coverage.',
    careersBenefits: [
        'Guaranteed Salary credit by the 7th of every month',
        'Compliant Provident Fund (PF) and Pension accounts',
        'ESI Medical Insurance coverage for you and your family',
        'Complimentary uniform set and duty accessories',
        'Transparent digital attendance log and leaves tracking'
    ]
};

export const getWebsiteConfig = async (): Promise<WebsiteServiceData> => {
    try {
        const docRef = doc(db, 'settings', 'public_website');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            const data = snap.data() as WebsiteServiceData;
            return {
                ...DEFAULT_CONFIG,
                ...data,
                // Ensure array fields are not undefined
                services: data.services || DEFAULT_CONFIG.services,
                careersBenefits: data.careersBenefits || DEFAULT_CONFIG.careersBenefits
            };
        } else {
            return DEFAULT_CONFIG;
        }
    } catch (err) {
        console.error('Error fetching website config:', err);
        return DEFAULT_CONFIG;
    }
};

export const updateWebsiteConfig = async (config: WebsiteServiceData): Promise<void> => {
    const docRef = doc(db, 'settings', 'public_website');
    await setDoc(docRef, config);
    await logSystemAction('UPDATE', 'SETTINGS', 'Updated public website CMS configuration & contact settings');
};
