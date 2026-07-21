#!/usr/bin/env ruby
# frozen_string_literal: true

# Temporary UAT-only Helm post-renderer.
#
# The shared SOBA chart normally creates <release>-formio. This bridge removes
# that generated Secret and redirects references to a separately managed UAT
# runtime Secret. It deliberately never reads the runtime Secret, preventing
# its credentials from entering Helm release metadata.
#
# It also adds the UAT-only PostgreSQL access policy. The Crunchy chart's
# generated policy permits database-to-database traffic only; this additional
# policy permits SOBA UAT pods to reach the PostgreSQL primary on TCP 5432.

require 'yaml'

source_secret = ENV.fetch('FORMIO_HELM_SECRET')
runtime_secret = ENV.fetch('FORMIO_RUNTIME_SECRET')

def replace_secret_refs(value, source_secret, runtime_secret)
  case value
  when Hash
    value.each do |key, child|
      if key == 'secretRef' && child.is_a?(Hash) && child['name'] == source_secret
        child['name'] = runtime_secret
      else
        value[key] = replace_secret_refs(child, source_secret, runtime_secret)
      end
    end
  when Array
    value.map! do |child|
      replace_secret_refs(child, source_secret, runtime_secret)
    end
  else
    value
  end
end

YAML.load_stream($stdin.read).each do |document|
  next if document.nil?
  next if document['kind'] == 'Secret' && document.dig('metadata', 'name') == source_secret

  puts YAML.dump(replace_secret_refs(document, source_secret, runtime_secret))
end

puts YAML.dump({
  'apiVersion' => 'networking.k8s.io/v1',
  'kind' => 'NetworkPolicy',
  'metadata' => {
    'name' => 'soba-uat-postgres-access',
    # The migration Job is a Helm pre-install/pre-upgrade hook. This policy must
    # be a hook too, with an earlier weight, otherwise Helm runs the migration
    # before it applies the policy.
    'annotations' => {
      'helm.sh/hook' => 'pre-install,pre-upgrade',
      'helm.sh/hook-weight' => '-1',
      'helm.sh/hook-delete-policy' => 'before-hook-creation'
    },
    'labels' => {
      'app.kubernetes.io/instance' => 'soba-uat',
      'app.kubernetes.io/name' => 'soba'
    }
  },
  'spec' => {
    'podSelector' => {
      'matchLabels' => {
        'postgres-operator.crunchydata.com/cluster' => 'pg-soba-crunchy'
      }
    },
    'policyTypes' => ['Ingress'],
    'ingress' => [{
      'from' => [{
        'podSelector' => {
          'matchLabels' => {
            'app.kubernetes.io/instance' => 'soba-uat',
            'app.kubernetes.io/name' => 'soba'
          }
        }
      }],
      'ports' => [{
        'protocol' => 'TCP',
        'port' => 5432
      }]
    }]
  }
})
