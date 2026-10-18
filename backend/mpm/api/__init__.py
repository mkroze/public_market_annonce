"""HTTP surfaces: the public/member app (`main`) and the admin router (`admin`).

The top layer. These two import each other lazily inside request handlers, so
nothing here may import them eagerly.
"""
