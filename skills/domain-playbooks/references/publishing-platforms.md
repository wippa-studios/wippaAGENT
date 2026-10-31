# Publishing platforms

**What to do**

- Keep custom code to a minimum and keep it to a known shape. Prefer a child theme or a small set of plugins over edits to core, so upgrades stay routine.

**The working stack**

- Core surface: PHP 8 and MySQL or MariaDB, the query builder, custom post types and taxonomies, post meta, the transients API, and the revision and cron behaviour of the core.
- Caching: a persistent object cache in Redis or Memcached in front of the database layer, a page cache at the edge, and a CDN for the static assets. Fix the query count before adding another cache layer.
- Theme and editor layer: classic themes with a child theme, and the full-site editing (FSE) block themes with the block templates, patterns and inner blocks for nested composition.
- Engineering standards: PSR-12 formatting, namespaced plugin code built on the hook system, nonces and capability checks on every privileged action, prepared statements for every query, and output escaping at every render. Operate it with the command line tool for the repeatable jobs, and use the REST API or a GraphQL layer for headless delivery.
- Respect the platform's conventions: the template hierarchy, `WP_Query`, custom post types and taxonomies, meta, and transients. Fighting the query builder is how sites end up with a hundred queries per page.
- Cache in layers. A page cache in front, an object cache for the database layer, and CDN offload for assets. Fix the query count before adding more cache.
- Write plugin code that is namespaced, structured around a small set of public functions with private helpers, and built on the hook system rather than on template overrides.
- Secure every input and output. Nonces on state-changing requests, capability checks on every privileged action, prepared statements for every query, escaping on output, and sanitisation on input.
- Plan the upgrade path. Core, PHP and plugin versions move, and a site that cannot be updated is a site with an unpatched vulnerability.

**What to watch for**

- Autoloaded options bloating every request, and unbounded postmeta queries.
- Cron events that pile up because the site traffic cannot trigger them.
- Admin and plugin directories exposed to the web, and file permissions that let the web server write to code.
- Third-party plugins with a large privilege surface, abandoned maintenance, and undisclosed data egress.

**How to verify**

- A query trace on a page load with the count before and after, reported as a real number from the trace.
- A page weight and Core Web Vitals field measurement.
- A static analysis and a dependency vulnerability scan on the codebase.
- A staged core, plugin and PHP upgrade rehearsal on a copy of the production database.

