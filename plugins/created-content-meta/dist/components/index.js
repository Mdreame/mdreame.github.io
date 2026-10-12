import { ContentMeta } from "@quartz-community/content-meta"
import { creationDate } from "../../../shared/creation-date.js"

export function withCreatedDate(fileData) {
  const value = creationDate(fileData)
  const created = value === undefined ? null : new Date(value)
  return {
    ...fileData,
    defaultDateType: "created",
    dates: {
      ...fileData.dates,
      created: created && !Number.isNaN(created.getTime()) ? created : fileData.dates?.created,
    },
  }
}

function CreatedContentMeta(options) {
  const ContentMetadata = ContentMeta(options)
  const Component = (props) =>
    ContentMetadata({ ...props, fileData: withCreatedDate(props.fileData) })

  Component.css = ContentMetadata.css
  Component.beforeDOMLoaded = ContentMetadata.beforeDOMLoaded
  Component.afterDOMLoaded = ContentMetadata.afterDOMLoaded
  Component.displayName = "CreatedContentMeta"
  return Component
}

export { CreatedContentMeta, CreatedContentMeta as default }
