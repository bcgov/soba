{{/*
Chart name, truncated to 63 chars.
*/}}
{{- define "soba.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Fully qualified app name: <chart>-<release>.
If release name already contains the chart name, avoid duplication.
Truncated to 63 chars (K8s label limit).
*/}}
{{- define "soba.fullname" -}}
{{- if .Values.fullnameOverride }}
  {{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
  {{- $name := default .Chart.Name .Values.nameOverride }}
  {{- if contains $name .Release.Name }}
    {{- .Release.Name | trunc 63 | trimSuffix "-" }}
  {{- else }}
    {{- printf "%s-%s" $name .Release.Name | trunc 63 | trimSuffix "-" }}
  {{- end }}
{{- end }}
{{- end }}

{{/*
Common labels applied to every resource.
Usage: {{ include "soba.labels" (dict "root" . "component" "backend") }}
*/}}
{{- define "soba.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .root.Chart.Name .root.Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
app.kubernetes.io/name: {{ include "soba.name" .root }}
app.kubernetes.io/instance: {{ .root.Release.Name }}
app.kubernetes.io/version: {{ .root.Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .root.Release.Service }}
{{- if .component }}
app.kubernetes.io/component: {{ .component }}
{{- end }}
{{- end }}

{{/*
Selector labels (immutable, used in matchLabels and pod template).
Usage: {{ include "soba.selectorLabels" (dict "root" . "component" "backend") }}
*/}}
{{- define "soba.selectorLabels" -}}
app.kubernetes.io/name: {{ include "soba.name" .root }}
app.kubernetes.io/instance: {{ .root.Release.Name }}
{{- if .component }}
app.kubernetes.io/component: {{ .component }}
{{- end }}
{{- end }}

{{/*
Resource-policy annotation: "keep" unless global.forceCleanup is true.
*/}}
{{- define "soba.keepPolicy" -}}
{{- if not .Values.global.forceCleanup }}
"helm.sh/resource-policy": keep
{{- end }}
{{- end }}

{{/*
Construct the Form.io base URL.
If formio is internal, point at the in-cluster service; otherwise use formio.external.url.
*/}}
{{- define "soba.formioBaseUrl" -}}
{{- if .Values.formio.internal.enabled }}
  {{- printf "http://%s-formio:%v" (include "soba.fullname" .) (.Values.formio.service.port | default 3001) }}
{{- else }}
  {{- .Values.formio.external.url }}
{{- end }}
{{- end }}

{{/*
Construct the MongoDB URI.
If mongodb is internal, point at the in-cluster service; otherwise use mongodb.external.uri.
*/}}
{{- define "soba.mongodbUri" -}}
{{- if .Values.mongodb.internal.enabled }}
  {{- printf "mongodb://%s-mongodb:%v/formio-ce" (include "soba.fullname" .) (.Values.mongodb.service.port | default 27017) }}
{{- else }}
  {{- .Values.mongodb.external.uri }}
{{- end }}
{{- end }}

{{/*
Frontend public URL (used for NEXT_PUBLIC_SOBA_API_BASE_URL and Route host).
*/}}
{{- define "soba.frontendHost" -}}
{{- printf "%s.%s" (include "soba.fullname" .) .Values.global.domain }}
{{- end }}

{{/*
Backend public URL host.
*/}}
{{- define "soba.backendHost" -}}
{{- printf "%s-api.%s" (include "soba.fullname" .) .Values.global.domain }}
{{- end }}
