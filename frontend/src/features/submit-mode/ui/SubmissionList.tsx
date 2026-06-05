'use client';

import React, { useEffect, useState } from 'react';
import { useKeycloak } from '@/lib/hooks/useKeycloak';
import { useDictionary } from '@/app/[lang]/Providers';
import { getSobaSubmissions } from '@/src/shared/api/sobaApiForms';
import type { SubmissionListItem } from '../types';

export function SubmissionList() {
  const { authenticated, token, initializing } = useKeycloak();
  const dict = useDictionary();
  const [submissions, setSubmissions] = useState<SubmissionListItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (authenticated && token) {
      getSobaSubmissions(token)
        .then((data) => {
          setSubmissions(data.items || []);
        })
        .catch((err) => console.error('Failed to fetch submissions', err))
        .finally(() => setIsLoaded(true));
    }
  }, [authenticated, token]);

  const loading = authenticated && token && !isLoaded;

  if (initializing || (authenticated && !token)) {
    return <div className="p-4">{dict.form?.loading || 'Loading submissions...'}</div>;
  }

  if (!authenticated) {
    return null;
  }

  return (
    <section>
      <div>
        <h2>{dict.submission?.submissions || 'Submissions'}</h2>
      </div>

      {loading ? (
        <div>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : submissions.length === 0 ? (
        <div>
          <p className="text-gray-500">{dict.submission?.empty || 'No submissions found yet.'}</p>
        </div>
      ) : (
        <div>
          <table>
            <thead>
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Submission ID
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Form Name
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Form ID
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Version
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {submissions.map((sub) => (
                <tr key={sub.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono">
                      {sub.id}
                    </code>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 font-semibold">
                    {sub.formName || 'Untitled Form'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono text-xs">
                    {sub.formId}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs font-bold">
                      v{sub.versionNo || 1}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span
                      className={`px-3 py-1 inline-flex text-xs leading-5 font-bold rounded-full border ${
                        sub.workflowState === 'submitted'
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      {sub.workflowState.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default SubmissionList;
