import React from 'react';

export const LinkRenderer = (props: any) => {
    const isAssetLink = props.href && props.href.startsWith('/uploads/');

    if (isAssetLink) {
        return (
            <a
                href={props.href}
                target="_blank"
                rel="noopener noreferrer"
                download={props.children.toString().includes('documento') || props.children.toString().includes('Documento') ? true : undefined}
                className="text-orange-600 hover:text-orange-800 underline"
            >
                {props.children}
            </a>
        );
    }
    return <a {...props} className="text-orange-600 hover:text-orange-800 underline">{props.children}</a>;
};