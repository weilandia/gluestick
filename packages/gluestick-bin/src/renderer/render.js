/* @flow */
import type { Context, Request, RenderOutput, RenderMethod } from '../types';

const React = require('react');
const { RouterContext } = require('react-router');
const Oy = require('oy-vey').default;
const { renderToString, renderToStaticMarkup } = require('react-dom/server');
const linkAssets = require('./helpers/linkAssets');

const getRenderer = (
  isEmail: boolean,
  renderMethod?: RenderMethod,
): Function => {
  if (renderMethod) {
    return renderMethod;
  }
  return isEmail ? renderToStaticMarkup : renderToString;
};

type EntryRequirements = {
  EntryPoint: Object;
  entryName: string;
  store: Object;
  routes: Function;
  httpClient: Object;
};
type WrappersRequirements = {
  EntryWrapper: Object;
  BodyWrapper: Object;
  entryWrapperConfig: Object;
  envVariables: any[];
  entriesPlugins: Function[];
};
module.exports = (
  context: Context,
  req: Request,
  { EntryPoint, entryName, store, routes, httpClient }: EntryRequirements,
  { renderProps, currentRoute }: { renderProps: Object; currentRoute: Object },
  {
    EntryWrapper,
    BodyWrapper,
    entryWrapperConfig,
    envVariables,
    entriesPlugins,
  }: WrappersRequirements,
  { assets, cacheManager }: { assets: Object; cacheManager: Object },
  { renderMethod }: { renderMethod?: RenderMethod } = {},
): RenderOutput => {
  const { styleTags, scriptTags } = linkAssets(context, entryName, assets);
  const isEmail = !!currentRoute.email;
  const routerContext = <RouterContext {...renderProps} />;
  const rootWrappers = entriesPlugins.filter((plugin) => plugin.meta.wrapper);
  const entryWrapper = (
    <EntryWrapper
      store={store}
      routerContext={routerContext}
      config={entryWrapperConfig}
      getRoutes={routes}
      httpClient={httpClient}
      rootWrappers={rootWrappers}
      rootWrappersOptions={{
        userAgent: req.headers['user-agent'],
      }}
    />
  );

  // grab the react generated body stuff. This includes the
  // script tag that hooks up the client side react code.
  const currentState: Object = store.getState();

  const renderResults: Object = getRenderer(isEmail, renderMethod)(entryWrapper, styleTags);
  const bodyWrapperContent: String = renderMethod ? renderResults.body : renderResults;
  const bodyWrapper = (
    <BodyWrapper
      html={bodyWrapperContent}
      initialState={currentState}
      isEmail={isEmail}
      envVariables={envVariables}
      scriptTags={scriptTags}
    />
  );


  // Grab the html from the project which is stored in the root
  // folder named Index.js. Pass the body and the head to that
  // component. `head` includes stuff that we want the server to
  // always add inside the <head> tag.
  //
  // Bundle it all up into a string, add the doctype and deliver
  const rootElement = (
    <EntryPoint
      body={bodyWrapper}
      head={isEmail ? null : renderResults.head || styleTags}
      req={req}
    />
  );

  let responseString: string;
  if (isEmail) {
    const generateCustomTemplate = ({ bodyContent }) => { return `${bodyContent}`; };
    responseString = Oy.renderTemplate(rootElement, {}, generateCustomTemplate);
  } else {
    responseString = renderToStaticMarkup(rootElement);
  }
  if (currentRoute.cache) {
    cacheManager.setCacheIfProd(req, responseString, currentRoute.cacheTTL);
  }
  return {
    responseString,
    rootElement, // only for testing
  };
};