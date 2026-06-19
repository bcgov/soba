'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useDictionary } from '../[lang]/Providers';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { FaWpforms, FaCommentDots, FaCircleQuestion, FaHouse, FaBuilding } from 'react-icons/fa6';
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
      testId: 'home-nav',
      icon: <FaHouse size={20} />,
      isActive: pathname === `/` || pathname === `/${locale}`,
    });
  }
  if (showAppLinks) {
    navItems.push(
      {
        href: `/${locale}/workspaces`,
        title: dict.header.workspaces,
        testId: 'workspaces-nav',
        icon: <FaBuilding size={20} />,
        isActive: pathname.startsWith(`/${locale}/workspaces`),
      },
      {
        href: `/${locale}/forms`,
        title: dict.general.forms,
        testId: 'forms-nav',
        icon: <FaWpforms size={20} />,
        isActive: pathname.startsWith(`/${locale}/forms`),
      },
      {
        href: `/${locale}/feedback`,
        title: dict.general.feedback,
        testId: 'feedback-nav',
        icon: <FaCommentDots size={20} />,
        isActive: pathname.startsWith(`/${locale}/feedback`),
      },
      {
        href: `/${locale}/help`,
        title: dict.general.help,
        testId: 'help-nav',
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
              data-testid={item.testId}
              className={`nav-link d-flex align-items-center gap-3 px-3 py-2 text-decoration-none rounded text-dark ${
                styles.navLink
              } ${item.isActive ? styles.navActive : ''}`}
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
