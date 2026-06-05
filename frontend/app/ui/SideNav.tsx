'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useDictionary } from '../[lang]/Providers';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { FaWpforms, FaCommentDots, FaCircleQuestion, FaHouse } from 'react-icons/fa6';
import styles from './SideNav.module.css';

interface SideNavProps {
  showAppLinks: boolean;
  showHome: boolean;
}

export function SideNav({ showAppLinks, showHome }: SideNavProps) {
  const { authenticated } = useKeycloak();
  const dict = useDictionary();
  const pathname = usePathname();
  const locale = dict.locale === 'en' || dict.locale === 'fr' ? dict.locale : 'en';

  if (!authenticated) {
    return null;
  }

  const navItems = [];
  if (showHome) {
    navItems.push({
      href: `/`,
      title: 'Home',
      icon: <FaHouse size={20} />,
      isActive: pathname === `/` || pathname === `/${locale}`,
    });
  }
  if (showAppLinks) {
    navItems.push(
      {
        href: `/${locale}/forms`,
        title: dict.general.forms,
        icon: <FaWpforms size={20} />,
        isActive: pathname.startsWith(`/${locale}/forms`),
      },
      {
        href: `/${locale}/feedback`,
        title: dict.general.feedback,
        icon: <FaCommentDots size={20} />,
        isActive: pathname.startsWith(`/${locale}/feedback`),
      },
      {
        href: `/${locale}/help`,
        title: dict.general.help,
        icon: <FaCircleQuestion size={20} />,
        isActive: pathname.startsWith(`/${locale}/help`),
      },
    );
  }

  return (
    <nav className={`d-flex flex-column py-3 px-2 ${styles.sideNav}`}>
      <ul className="nav flex-column gap-2">
        {navItems.map((item) => (
          <li className="nav-item" key={item.href}>
            <Link
              href={item.href}
              className={`nav-link d-flex align-items-center gap-3 px-3 py-2 text-decoration-none rounded ${
                item.isActive ? 'bg-primary text-white' : 'text-dark hover-bg-light'
              }`}
              title={item.title}
            >
              <div className="d-flex justify-content-center" style={{ width: '24px' }}>
                {item.icon}
              </div>
              <span className="d-none d-md-block fw-medium">{item.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
