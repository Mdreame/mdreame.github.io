import { jsx } from "preact/jsx-runtime"

const h = (type, props, ...kids) => {
  if (kids.length === 0) return jsx(type, props)
  return jsx(type, { ...props, children: kids.length === 1 ? kids[0] : kids })
}

var css = `
.garden-link {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  padding: 0.55rem 0.75rem;
  border: 1px solid var(--lightgray);
  border-radius: 8px;
  text-decoration: none;
  color: var(--dark);
  background: linear-gradient(120deg, rgba(122, 189, 104, 0.12), rgba(122, 189, 104, 0));
  transition: border-color 0.2s ease, transform 0.2s ease;
}
.garden-link:hover {
  border-color: var(--tertiary);
  transform: translateY(-1px);
}
.garden-link-title {
  font-size: 0.9rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 0.35rem;
}
.garden-link-title svg {
  width: 13px;
  height: 13px;
  flex-shrink: 0;
}
.garden-link-desc {
  font-size: 0.72rem;
  color: var(--gray);
  line-height: 1.35;
}
`

var GardenLink = (userOpts) => {
  const opts = {
    href: "/garden",
    label: "花园",
    desc: "把笔记种成一座可以旋转的岛",
    ...userOpts,
  }

  const GardenLinkComponent = () =>
    h(
      "a",
      {
        class: "garden-link",
        href: opts.href,
        "data-router-ignore": "",
        "data-no-popover": "true",
      },
      h("span", { class: "garden-link-title" }, [
        h(
          "svg",
          { viewBox: "0 0 24 24", fill: "none", "aria-hidden": "true" },
          h("path", {
            d: "M12 3 L7 11 H10 L6 18 H18 L14 11 H17 Z",
            fill: "currentColor",
            opacity: "0.75",
          }),
          h("path", { d: "M12 18 V21", stroke: "currentColor", "stroke-width": "2" }),
        ),
        opts.label,
      ]),
      h("span", { class: "garden-link-desc", children: opts.desc }),
    )

  GardenLinkComponent.css = css
  GardenLinkComponent.displayName = "GardenLink"
  return GardenLinkComponent
}

export { GardenLink, GardenLink as default }
