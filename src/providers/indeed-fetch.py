"""Bounded, read-only JobSpy bridge. stdout is JSON; never emits provider logs."""
import json
import logging
import sys
from importlib.metadata import version


def main():
    from jobspy import scrape_jobs
    query = sys.argv[1]
    if not query.strip() or len(query) > 160:
        raise ValueError('invalid query')
    if version('python-jobspy') != '1.3.0':
        raise RuntimeError('jobspy version changed; validate before upgrading')
    errors = []

    class Capture(logging.Handler):
        def emit(self, record):
            if record.levelno >= logging.ERROR:
                errors.append(True)  # Do not propagate response bodies, headers or URLs.

    logger = logging.getLogger('JobSpy:Indeed')
    logger.handlers = [Capture()]
    logger.propagate = False
    data = scrape_jobs(site_name=['indeed'], search_term=query, location=sys.argv[2],
                       country_indeed='Taiwan', results_wanted=10,
                       description_format='markdown', verbose=0)
    columns = ['site', 'title', 'company', 'job_url', 'job_url_direct',
               'description', 'location', 'date_posted', 'is_remote']
    rows = json.loads(data[[c for c in columns if c in data]].to_json(
        orient='records', date_format='iso'))
    return {'status': 'partial' if rows and errors else 'error' if errors else 'ok',
            'rows': rows, 'errors': len(errors), 'version': '1.3.0'}


if __name__ == '__main__':
    try:
        print(json.dumps(main(), ensure_ascii=False))
    except Exception:
        print(json.dumps({'status': 'error', 'rows': [], 'errors': 1}))
        sys.exit(1)
