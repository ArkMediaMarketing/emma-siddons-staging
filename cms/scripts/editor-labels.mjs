/** Editorial names are explicit metadata, independent of editable copy. */
const sections={
 home:['Hero','Client reviews','Property search service','About me','Areas covered','Off-market homes','Contact'],
 'home-new':['Hero','Credentials','About Emma','Buyer benefits','Off-market homes','Buying process','Services & fees','Areas covered','Client testimonial','Off-market guide','Frequently asked questions','Contact','Client reviews'],
 v2:['Hero','Property search service','About Emma','Off-market homes','Areas covered','Client testimonial','Frequently asked questions','Contact'],
 'about-me':['Introduction','Local knowledge & background','Personal service','Contact','Profile','Emma in brief','What I bring','Client reviews','Working with me','Contact'],
 'areas-covered':['Introduction','Hertfordshire','Neighbouring counties','Choosing an area','Contact'],
 contact:['Introduction','Contact options','Search coverage'],
 'guides--finding-off-market-homes':['Guide introduction','Contact'],
 'how-i-can-help-you':['Introduction','Buying process','Contact'],
 'off-market-homes-hertfordshire':['Introduction','Understanding off-market homes','Finding the right fit','Private buying guide','Contact'],
 'services-and-fees':['Introduction','Property search service','Fees & payment','Contact'],
};
const columns={
 'about-me':[[1,0,'Local knowledge'],[1,1,'Professional background']],
 'areas-covered':[[2,0,'West Essex'],[2,1,'South Cambridgeshire']],
 'services-and-fees':[[1,0,'Property search service'],[1,1,'Personal attention'],[2,0,'Fee overview'],[2,1,'Fee breakdown']],
 'off-market-homes-hertfordshire':[[1,0,'Off-market buying'],[1,1,'Finding private opportunities']],
 contact:[[1,0,'Telephone contact'],[1,1,'Email contact']],
};
function nameHeadingRuns($,root,names){let index=-1;root.children().each((_,el)=>{if(/^h[23]$/.test(el.name))index++;if(index>=0&&names[index])$(el).attr('data-editor-section',names[index]);});}
export function nameEditorSections($,container,id){
 const nodes=container.find('section');
 nodes.each((index,el)=>{const name=sections[id]?.[index];if(!name)throw new Error(`Name the new section on ${id} at position ${index}.`);$(el).attr('data-editor-section',name);});
 for(const [index,column,name]of columns[id]||[]){const section=nodes.eq(index);const grid=section.hasClass('editorial-grid')?section:section.find('.editorial-grid').first();const target=(grid.length?grid:section).children('div').eq(column);target.attr('data-editor-section',name);}
 if(id==='guides--finding-off-market-homes')nameHeadingRuns($,container.find('article.guide-copy'),['Search priorities','Reasons for private sales','Local conversations','Buying readiness','Property assessment']);
 if(id==='services-and-fees')nameHeadingRuns($,container.find('.fee-panel'),['Initial retainer','Success fee & payment terms']);
 if(id==='home-new')container.find('.nh-fees__figures>div').each((index,el)=>$(el).attr('data-editor-section',index===0?'Initial retainer':'Success fee'));
}
