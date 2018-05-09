# -*- coding: utf-8 -*-

"""
core4.util provides various support and helper methods used by various core4
packages and modules.
"""

import re

REGEX_MODIFIER = {
    u'i': re.I,
    u'm': re.M,
    u's': re.S,
    # u'l': re.L,
    # u'x': re.X,
    # u'u': re.U
}


def parse_regex(regex):
    """
    Translates the passed string into a Python compiled re (regular expression).
    String format is using the slash delimiter with attached regular expression
    modifies i (case-insensitive), m (multi-lines match) and s (dot matching
    newlines). A string not following this form is translated into /<string>/.

    :param regex: regular expression string
    :return: Python compiled re object
    """
    if not regex.startswith('/'):
        regex = "/" + regex + "/"
    parts = regex.split('/')
    flags = 0
    try:
        pattern = "/".join(parts[1:-1])
        for f in parts[-1].lower():
            flags = flags | REGEX_MODIFIER[f]
    except:
        raise re.error(
            'invalid regular expression or option [{}]'.format(regex))
    return re.compile(pattern, flags)
