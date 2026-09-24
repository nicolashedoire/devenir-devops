{{- define "taskboard.name" -}}
{{- if gt (len .Release.Name) 40 -}}
{{- fail "Le nom de release doit contenir au plus 40 caractères pour conserver des noms de ressources stables." -}}
{{- end -}}
{{- .Release.Name -}}
{{- end -}}

{{- define "taskboard.labels" -}}
app.kubernetes.io/name: taskboard
app.kubernetes.io/instance: {{ .Release.Name | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service | quote }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | quote }}
{{- end -}}

{{- define "taskboard.selector" -}}
app.kubernetes.io/name: taskboard
app.kubernetes.io/instance: {{ .Release.Name | quote }}
{{- end -}}

{{- define "taskboard.image" -}}
{{- printf "%s@%s" .Values.image.repository (required "image.digest est obligatoire." .Values.image.digest) -}}
{{- end -}}

{{- define "taskboard.databaseEnv" -}}
- name: DATABASE_URL
  valueFrom:
    secretKeyRef:
      name: {{ required "database.existingSecret doit désigner un Secret préexistant." .Values.database.existingSecret | quote }}
      key: DATABASE_URL
{{- end -}}

{{- define "taskboard.containerSecurity" -}}
allowPrivilegeEscalation: false
readOnlyRootFilesystem: true
capabilities:
  drop: ["ALL"]
{{- end -}}
